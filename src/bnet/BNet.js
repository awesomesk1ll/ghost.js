import net from 'net';
import bp from 'bufferpack';
import assert from 'assert';
import path from 'path';
import EventEmitter from 'events';
import {getTicks, getTime} from './../util';
import {ByteArray, GetLength} from './../Bytes';
import BNetProtocol, {receivers} from './BNetProtocol';
import CommandPacket from '../CommandPacket';
import BNCSUtil from './../../libbncsutil/BNCSUtil';
import {create, hex} from '../Logger';

const {debug, info, error} = create('BNet');

/**
 *
 * @param {String} key
 * @param {Number} clientToken
 * @param {Number} serverToken
 * @returns {Buffer}
 */
function createKeyInfo(key, clientToken, serverToken) {
	var info = BNCSUtil.kd_quick(key, clientToken, serverToken);
	var bytes = [
		bp.pack('<I', key.length),
		bp.pack('<I', info.product),
		bp.pack('<I', info.publicValue),
		'\x00\x00\x00\x00',
		info.hash
	];

	return ByteArray(bytes);
}

/**
 * Class for connecting to
 * @param {Object} options
 * @constructor
 */
class BNet extends EventEmitter {
	constructor(config, TFT, hostPort, hostCounterID) {
		super();

		if (!config) {
			info(`empty config for battle.net connection #${this.id}`);
			return;
		}

		this.id = hostCounterID;
		this.hostPort = hostPort;
		this.tft = TFT;

		this.socket = new net.Socket();
		this.protocol = new BNetProtocol(this);

		this.data = Buffer.from('');
		this.incomingPackets = [];
		this.incomingBuffer = Buffer.from('');

		this.clientToken = Buffer.from('\xdc\x01\xcb\x07', 'binary');

		this.lastPacketTime = 0;
		this.packetInterval = 4.0;
		this.admins = [];

		this.server = config.item('server');
		this.alias = config.item('alias');

		this.bnlsServer = config.item('bnls.server', false);
		this.bnlsPort = config.item('bnls.port', 9367);
		this.bnlsWardenCookie = config.item('bnls.wardencookie', false);

		this.commandTrigger = config.item('commandtrigger', '!');
		assert(this.commandTrigger !== '', 'command trigger empty');

		this.war3version = config.item('custom.war3version', '26');
		this.exeVersion = config.item('custom.exeversion', false);
		this.exeVersionHash = config.item('custom.exeversionhash', false);
		this.passwordHashType = config.item('custom.passwordhashyype', '');
		this.pvpgnRealmName = config.item('custom.pvpgnrealmName', 'PvPGN Realm');
		this.maxMessageLength = config.item('custom.maxmessagelength', 200);

		console.log('this.passwordHashType', this.passwordHashType);

		this.localeID = config.item('localeid', '1033');
		this.countryAbbrev = config.item('countryabbrev', 'USA');
		this.country = config.item('country', 'United States');

		this.war3exePath = path.resolve(config.item('war3exe', 'war3.exe'));
		this.stormdllPath = path.resolve(config.item('stormdll', 'Storm.dll'));
		this.gamedllPath = path.resolve(config.item('gamedll', 'game.dll'));

		this.keyROC = config.item('keyroc', 'FFFFFFFFFFFFFFFFFFFFFFFFFF');
		assert(this.keyROC !== '', 'ROC CD-Key empty');
		this.keyTFT = config.item('keytft', 'FFFFFFFFFFFFFFFFFFFFFFFFFF');
		assert(this.keyTFT !== '', 'TFT CD-Key empty');

		this.username = config.item('username', '');
		assert(this.username !== '', 'username empty');
		this.password = config.item('password', '');
		assert(this.password !== '', 'password empty');

		this.firstChannel = config.item('firstchannel', 'The Void');
		this.rootAdmin = config.item('rootadmin', false);

		info(`found battle.net connection #${this.id} for server ${this.server}`);

		this.loggedIn = false;
		this.inChat = false;

		this.connected = false;
		this.connecting = false;
		this.exiting = false;

		this.lastDisconnectedTime = 0;
		this.lastConnectionAttemptTime = 0;
		this.lastNullTime = 0;
		this.lastOutPacketTicks = 0;
		this.lastOutPacketSize = 0;
		this.frequencyDelayTimes = 0;

		this.firstConnect = true;

		this.configureSocket();
		this.configureHandlers();

		// this.handlers = {
		// 	[BNetProtocol.SID_PING.charCodeAt(0)]: this.HANDLE_SID_PING,
		//
		// 	[BNetProtocol.SID_AUTH_INFO.charCodeAt(0)]: this.HANDLE_SID_AUTH_INFO,
		// 	[BNetProtocol.SID_AUTH_CHECK.charCodeAt(0)]: this.HANDLE_SID_AUTH_CHECK,
		// 	[BNetProtocol.SID_AUTH_ACCOUNTLOGON.charCodeAt(0)]: this.HANDLE_SID_AUTH_ACCOUNTLOGON,
		// 	[BNetProtocol.SID_AUTH_ACCOUNTLOGONPROOF.charCodeAt(0)]: this.HANDLE_SID_AUTH_ACCOUNTLOGONPROOF,
		// 	[BNetProtocol.SID_REQUIREDWORK.charCodeAt(0)]: this.HANDLE_SID_REQUIREDWORK,
		//
		// 	[BNetProtocol.SID_NULL.charCodeAt(0)]: this.HANDLE_SID_NULL,
		// 	[BNetProtocol.SID_ENTERCHAT.charCodeAt(0)]: this.HANDLE_SID_ENTERCHAT,
		// 	[BNetProtocol.SID_CHATEVENT.charCodeAt(0)]: this.HANDLE_SID_CHATEVENT,
		// 	[BNetProtocol.SID_CLANINFO.charCodeAt(0)]: this.HANDLE_SID_CLANINFO,
		// 	[BNetProtocol.SID_CLANMEMBERLIST.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERLIST,
		// 	[BNetProtocol.SID_CLANMEMBERSTATUSCHANGE.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERSTATUSCHANGE,
		// 	[BNetProtocol.SID_MESSAGEBOX.charCodeAt(0)]: this.HANDLE_SID_MESSAGEBOX,
		//
		// 	[BNetProtocol.SID_CLANINVITATION.charCodeAt(0)]: this.HANDLE_SID_CLANINVITATION,
		// 	[BNetProtocol.SID_CLANMEMBERREMOVED.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERREMOVED,
		// 	[BNetProtocol.SID_FRIENDSUPDATE.charCodeAt(0)]: this.HANDLE_SID_FRIENDSUPDATE,
		// 	[BNetProtocol.SID_FRIENDSLIST.charCodeAt(0)]: this.HANDLE_SID_FRIENDSLIST,
		// 	[BNetProtocol.SID_FLOODDETECTED.charCodeAt(0)]: this.HANDLE_SID_FLOODDETECTED,
		// 	[BNetProtocol.SID_FRIENDSADD.charCodeAt(0)]: this.HANDLE_SID_FRIENDSADD
		// };
	}

	configureSocket() {
		this.socket
			.on('close', () => {
				info('connection close');
			})

			.on('connect', () => {
				this.connected = true;
				this.connecting = true;
			})

			.on('data', (buffer) => {
				hex(buffer);

				this.incomingBuffer = Buffer.concat([this.incomingBuffer, buffer]);

				this.extractPackets();
				this.processPackets();
			})

			.on('drain', (...args) => {
				info('connection drain', ...args);
			})

			.on('end', () => {
				info('connection end');
			})

			.on('error', (err) => {
				info(`${this.alias} disconnected from battle.net due to socket error ${err}`);

				this.lastDisconnectedTime = getTime();
				this.loggedIn = false;
				this.inChat = false;
				this.waitingToConnect = true;
			})

			.on('lookup', () => {
				info('connection lookup');
			})

			.on('timeout', () => {
				info('connection timeout');
			});
	}

	configureHandlers() {
		this.handlers = {};

		for (let type of [
			'SID_PING',
			'SID_AUTH_INFO',
			'SID_AUTH_CHECK',
			'SID_AUTH_ACCOUNTLOGON',
			'SID_AUTH_ACCOUNTLOGONPROOF',
			'SID_REQUIREDWORK',
			'SID_NULL',
			'SID_ENTERCHAT',
			'SID_CHATEVENT',
			'SID_CLANINFO',
			'SID_CLANMEMBERLIST',
			'SID_CLANMEMBERSTATUSCHANGE',
			'SID_MESSAGEBOX',
			'SID_CLANINVITATION',
			'SID_CLANMEMBERREMOVED',
			'SID_FRIENDSUPDATE',
			'SID_FRIENDSLIST',
			'SID_FLOODDETECTED',
			'SID_FRIENDSADD'
		]) {
			this.handlers[this.protocol[type].charCodeAt(0)] = this[`HANDLE_${type}`];
		}
	}

	/**
	 * @param {Buffer|Array} buffer
	 * @returns {*|Number}
	 */
	sendPackets(buffer) {
		buffer = Array.isArray(buffer) ? Buffer.concat(buffer) : buffer;
		assert(Buffer.isBuffer(buffer), 'BNet.sendPackets expects buffer');

		hex(buffer);
		return this.socket.write(buffer);
	}

	extractPackets() {
		while (this.incomingBuffer.length >= 4) {
			var buffer = this.incomingBuffer;

			if (!this.protocol.haveHeader(buffer)) {
				error('received invalid packet from battle.net (bad header constant), disconnecting');
				this.socket.end();
			}

			const len = GetLength(buffer);

			if (len < 4) {
				error('received invalid packet from battle.net (bad length), disconnecting');
				return;
			}

			if (buffer.length >= len) {
				this.incomingPackets.push(
					new CommandPacket(
						this.protocol.BNET_HEADER_CONSTANT,
						buffer[1],
						buffer.slice(0, len)
					)
				);

				this.incomingBuffer = buffer.slice(len);
			} else { // still waiting for rest of the packet
				return;
			}
		}
	}

	processPackets() {
		while (this.incomingPackets.length) {
			const packet = this.incomingPackets.pop();

			if (packet.type === this.protocol.BNET_HEADER_CONSTANT) {
				const receiver = this.protocol.receivers[packet.id];
				const handler = this.handlers[packet.id];

				(!handler) && error(`handler for packet '${packet.id}' not found`);
				(!receiver) && error(`receiver for packet '${packet.id}' not found`);

				handler && receiver && handler.call(this, receiver.call(this.protocol, packet.buffer));
			}
		}
	}

	//
	// start() {
	// 	this.intervalID = setInterval(() => {
	// 		if (this.update()) {
	// 			this.socket.end();
	// 			process.exit(0);
	// 			clearInterval(this.intervalID);
	// 		}
	// 	}, UPDATE_INTERVAL);
	//
	// 	process.on('SIGTERM', function () {
	// 		info('process exiting');
	// 		this.exiting = true;
	// 	});
	// }

	update() {
		if (this.connecting) {
			info('connected', this.alias, this.server, this.port);
			this.sendPackets([
				this.protocol.SEND_PROTOCOL_INITIALIZE_SELECTOR(),
				this.protocol.SEND_SID_AUTH_INFO(
					this.war3version,
					this.tft,
					this.localeID,
					this.countryAbbrev,
					this.country
				)
			]);

			this.lastNullTime = getTime();
			this.lastOutPacketTicks = getTicks();

			this.connecting = false;
		}

		if (this.connected) {
			// the connection attempt completed
			if (getTime() - this.lastNullTime >= 60) {
				this.sendPackets(this.protocol.SEND_SID_NULL());
				this.lastNullTime = getTime();
			}
		}

		if (!this.connecting && !this.connected && this.firstConnect) {
			info(`${this.alias} connecting to server ${this.server} on port 6112`);

			this.firstConnect = false;

			this.socket.connect(6112, this.server);
		}

		return this.exiting;
	}

	close() {
		this.socket.end();
	}

	sendJoinChannel(channel) {
		if (this.loggedIn && this.inChat) {
			this.sendPackets(this.protocol.SEND_SID_JOINCHANNEL(channel));
		}
	}

	sendGetFriendsList() {
		if (this.loggedIn) {
			this.sendPackets(this.protocol.SEND_SID_FRIENDSLIST());
		}
	}

	sendGetClanList() {
		if (this.loggedIn) {
			this.sendPackets(this.protocol.SEND_SID_CLANMEMBERLIST());
		}
	}

	queueEnterChat() {
		// if( m_LoggedIn )
		// m_OutPackets.push( m_Protocol->SEND_SID_ENTERCHAT( ) );
	}

	queueChatCommand(command) {
		if (!command.length) {
			return;
		}

		if (this.loggedIn) {

		}

		// if( chatCommand.empty( ) )
		// return;
		//
		// if( m_LoggedIn )
		// {
		// 	if( m_PasswordHashType == "pvpgn" && chatCommand.size( ) > m_MaxMessageLength )
		// 		chatCommand = chatCommand.substr( 0, m_MaxMessageLength );
		//
		// 	if( chatCommand.size( ) > 255 )
		// 		chatCommand = chatCommand.substr( 0, 255 );
		//
		// 	if( m_OutPackets.size( ) > 10 )
		// 		CONSOLE_Print( "[BNET: " + m_ServerAlias + "] attempted to queue chat command [" + chatCommand + "] but there are too many (" + UTIL_ToString( m_OutPackets.size( ) ) + ") packets queued, discarding" );
		// 	else
		// 	{
		// 		CONSOLE_Print( "[QUEUED: " + m_ServerAlias + "] " + chatCommand );
		// 		m_OutPackets.push( m_Protocol->SEND_SID_CHATCOMMAND( chatCommand ) );
		// 	}
		// }
	}

	queueWhisperCommand(user, command) {
		return this.queueChatCommand(`/w ${user} ${command}`);
	}

	isAdmin(user) {
		return Boolean(this.admins.find((name) => name === user));
	}

	isRootAdmin(user) {
		return this.rootAdmin === user;
	}

	HANDLE_SID_PING(d) {
		debug('HANDLE_SID_PING', d);
		this.sendPackets(this.protocol.SEND_SID_PING(d));
	}

	HANDLE_SID_AUTH_INFO(d) {
		debug('HANDLE_SID_AUTH_INFO', d);

		const exe = BNCSUtil.getExeInfo(this.war3exePath, BNCSUtil.getPlatform());

		let {exeInfo, exeVersion} = exe;

		exeVersion = bp.pack('<I', exeVersion);

		let exeVersionHash = BNCSUtil.checkRevisionFlat(
			d.valueStringFormula,
			this.war3exePath,
			this.stormdllPath,
			this.gamedllPath,
			BNCSUtil.extractMPQNumber(d.ix86VerFileName)
		);

		let keyInfoROC = createKeyInfo(
			this.keyROC,
			bp.unpack('<I', this.clientToken)[0],
			bp.unpack('<I', d.serverToken)[0]
		);

		let keyInfoTFT = '';

		if (this.TFT) {
			keyInfoTFT = createKeyInfo(
				this.keyTFT,
				bp.unpack('<I', this.clientToken)[0],
				bp.unpack('<I', d.serverToken)[0]
			);

			info('attempting to auth as Warcraft III: The Frozen Throne');
		} else {
			info('attempting to auth as Warcraft III: Reign of Chaos');
		}

		this.sendPackets(this.protocol.SEND_SID_AUTH_CHECK(
			this.tft,
			this.clientToken,
			exeVersion,
			bp.pack('<I', exeVersionHash),
			keyInfoROC,
			keyInfoTFT,
			exeInfo,
			'GHost.js'
		));
	}

	HANDLE_SID_AUTH_CHECK(d) {
		debug('HANDLE_SID_AUTH_CHECK', d);

		if (d.keyState.toString() !== this.protocol.KR_GOOD.toString()) {
			error('CD Key or version problem. See above');
		} else {
			let clientPublicKey;

			if (!this.nls) {
				this.nls = BNCSUtil.nls_init(this.username, this.password);
			}

			clientPublicKey = BNCSUtil.nls_get_A(this.nls);

			if (clientPublicKey.length !== 32) { // retry since bncsutil randomly fails
				this.nls = BNCSUtil.nls_init(this.username, this.password);
				clientPublicKey = BNCSUtil.nls_get_A(this.nls);

				assert(clientPublicKey.length === 32, 'client public key wrong length');
			}

			this.sendPackets(this.protocol.SEND_SID_AUTH_ACCOUNTLOGON(clientPublicKey, this.username));
		}
	}

	HANDLE_SID_REQUIREDWORK() {
		debug('HANDLE_SID_REQUIREDWORK');
		return;
	}

	HANDLE_SID_AUTH_ACCOUNTLOGON(d) {
		debug('HANDLE_SID_AUTH_ACCOUNTLOGON');
		var buff;

		info(`username ${this.username} accepted`);

		if (this.passwordHashType === 'pvpgn') {
			info('using pvpgn logon type (for pvpgn servers only)');

			buff = this.protocol.SEND_SID_AUTH_ACCOUNTLOGONPROOF(
				BNCSUtil.hashPassword(this.password)
			);

		} else {
			info('using battle.net logon type (for official battle.net servers only)');

			buff = this.protocol.SEND_SID_AUTH_ACCOUNTLOGONPROOF(
				BNCSUtil.nls_get_M1(this.nls, d.serverPublicKey, d.salt)
			);
		}

		this.sendPackets(buff);
	}

	HANDLE_SID_AUTH_ACCOUNTLOGONPROOF(d) {
		debug('HANDLE_SID_AUTH_ACCOUNTLOGONPROOF');

		if (!d) {
			error('Logon proof rejected.');
			return;
		}

		this.loggedIn = true;

		this.emit('SID_AUTH_ACCOUNTLOGONPROOF', this, d);

		info(`[${this.alias}] logon successful`);

		this.sendPackets([
			this.protocol.SEND_SID_NETGAMEPORT(this.hostPort),
			this.protocol.SEND_SID_ENTERCHAT(),
			this.protocol.SEND_SID_FRIENDSLIST(),
			this.protocol.SEND_SID_CLANMEMBERLIST()
		]);
	}

	HANDLE_SID_NULL() {
		debug('HANDLE_SID_NULL');
		// warning: we do not respond to NULL packets with a NULL packet of our own
		// this is because PVPGN servers are programmed to respond to NULL packets so it will create a vicious cycle of useless traffic
		// official battle.net servers do not respond to NULL packets
		return;
	}

	HANDLE_SID_ENTERCHAT(d) {
		debug('HANDLE_SID_ENTERCHAT');

		if ('#' === d.toString()[0]) {
			debug('Warning: Account already logged in.');
		}

		info(`joining channel [${this.firstChannel}]`);

		this.inChat = true;

		this.emit('SID_ENTERCHAT', this, d);
		this.sendPackets(this.protocol.SEND_SID_JOINCHANNEL(this.firstChannel));
	}

	HANDLE_SID_CHATEVENT(d) {
		debug('HANDLE_SID_CHATEVENT');

		this.emit('SID_CHATEVENT', this, d);
	}

	HANDLE_SID_CLANINFO() {
		debug('HANDLE_SID_CLANINFO');
	}

	HANDLE_SID_CLANMEMBERLIST() {
		debug('HANDLE_SID_CLANMEMBERLIST');
	}

	HANDLE_SID_CLANMEMBERSTATUSCHANGE() {
		debug('HANDLE_SID_CLANMEMBERSTATUSCHANGE');
	}

	HANDLE_SID_MESSAGEBOX(d) {
		debug('HANDLE_SID_MESSAGEBOX');
	}

	HANDLE_SID_FRIENDSLIST(friends) {
		debug('HANDLE_SID_FRIENDSLIST');

		this.emit('SID_FRIENDSLIST', this, friends);
	}
}

// export const handlers = {
// 	[BNetProtocol.SID_PING.charCodeAt(0)]: this.HANDLE_SID_PING,
//
// 	[BNetProtocol.SID_AUTH_INFO.charCodeAt(0)]: this.HANDLE_SID_AUTH_INFO,
// 	[BNetProtocol.SID_AUTH_CHECK.charCodeAt(0)]: this.HANDLE_SID_AUTH_CHECK,
// 	[BNetProtocol.SID_AUTH_ACCOUNTLOGON.charCodeAt(0)]: this.HANDLE_SID_AUTH_ACCOUNTLOGON,
// 	[BNetProtocol.SID_AUTH_ACCOUNTLOGONPROOF.charCodeAt(0)]: this.HANDLE_SID_AUTH_ACCOUNTLOGONPROOF,
// 	[BNetProtocol.SID_REQUIREDWORK.charCodeAt(0)]: this.HANDLE_SID_REQUIREDWORK,
//
// 	[BNetProtocol.SID_NULL.charCodeAt(0)]: this.HANDLE_SID_NULL,
// 	[BNetProtocol.SID_ENTERCHAT.charCodeAt(0)]: this.HANDLE_SID_ENTERCHAT,
// 	[BNetProtocol.SID_CHATEVENT.charCodeAt(0)]: this.HANDLE_SID_CHATEVENT,
// 	[BNetProtocol.SID_CLANINFO.charCodeAt(0)]: this.HANDLE_SID_CLANINFO,
// 	[BNetProtocol.SID_CLANMEMBERLIST.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERLIST,
// 	[BNetProtocol.SID_CLANMEMBERSTATUSCHANGE.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERSTATUSCHANGE,
// 	[BNetProtocol.SID_MESSAGEBOX.charCodeAt(0)]: this.HANDLE_SID_MESSAGEBOX,
//
// 	[BNetProtocol.SID_CLANINVITATION.charCodeAt(0)]: this.HANDLE_SID_CLANINVITATION,
// 	[BNetProtocol.SID_CLANMEMBERREMOVED.charCodeAt(0)]: this.HANDLE_SID_CLANMEMBERREMOVED,
// 	[BNetProtocol.SID_FRIENDSUPDATE.charCodeAt(0)]: this.HANDLE_SID_FRIENDSUPDATE,
// 	[BNetProtocol.SID_FRIENDSLIST.charCodeAt(0)]: this.HANDLE_SID_FRIENDSLIST,
// 	[BNetProtocol.SID_FLOODDETECTED.charCodeAt(0)]: this.HANDLE_SID_FLOODDETECTED,
// 	[BNetProtocol.SID_FRIENDSADD.charCodeAt(0)]: this.HANDLE_SID_FRIENDSADD
// };

export default BNet;