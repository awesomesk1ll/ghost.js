import * as bp from 'bufferpack';
import * as assert from 'assert';
import {localIP, getTimezone} from './../util';
import {ValidateLength, ByteUInt32, ByteString, ByteExtractString, ByteExtractUInt32} from './../Bytes';
import {Protocol} from './../Protocol';
import {Friend} from './Friend';
import {IncomingGameHost} from './IncomingGameHost';

import {create, hex} from '../Logger';
import {BNetConnection} from "./BNetConnection";

const {debug, info, error} = create('BNetProtocol');

export interface AuthInfo {
    logonType,
    serverToken,
    mpqFileTime,
    ix86VerFileName,
    valueString
}

export interface AuthState {
    state: number;
    description: string;
}

export interface AccountLogon {
    status,
    salt,
    serverPublicKey
}

export interface AccountLogonProof {
    status,
    proof,
    message
}

export class BNetProtocol extends Protocol {

    BNET_HEADER_CONSTANT = '\xff';

    INITIALIZE_SELECTOR = '\x01';

    SID_AUTH_INFO = '\x50';
    SID_PING = '\x25';
    SID_AUTH_CHECK = '\x51';
    SID_REQUIREDWORK = '\x4c';
    SID_AUTH_ACCOUNTLOGON = '\x53';
    SID_AUTH_ACCOUNTLOGONPROOF = '\x54';
    SID_NULL = '\x00';
    SID_NETGAMEPORT = '\x45';
    SID_ENTERCHAT = '\x0a';
    SID_JOINCHANNEL = '\x0c';
    SID_CHATEVENT = '\x0f';
    SID_CHATCOMMAND = '\x0e';
    SID_CLANINFO = '\x75';
    SID_CLANMEMBERLIST = '\x7d';
    SID_CLANMEMBERSTATUSCHANGE = '\x7f';
    SID_MESSAGEBOX = '\x19';
    SID_CLANINVITATION = '\x77';
    SID_CLANMEMBERREMOVED = '\x7e';
    SID_FRIENDSUPDATE = '\x66';
    SID_FRIENDSLIST = '\x65';
    SID_FLOODDETECTED = '\x13';
    SID_FRIENDSADD = '\x67';

    SID_GETADVLISTEX = '\x09';
    SID_STOPADV = '\x02';	// 0x2
    SID_CHECKAD = '\x15';	// 0x15
    SID_STARTADVEX3 = '\x1c';	// 0x1C
    SID_DISPLAYAD = '\x21';	// 0x21
    SID_NOTIFYJOIN = '\x22';	// 0x22
    SID_LOGONRESPONSE = '\x29';	// 0x29

    /*
     0x000: Passed challenge
     0x100: Old game version (Additional info field supplies patch MPQ filename)
     0x101: Invalid version
     0x102: Game version must be downgraded (Additional info field supplies patch MPQ filename)
     0x0NN: (where NN is the version code supplied in SID_AUTH_INFO): Invalid version code (note that 0x100 is not set in this case).
     0x200: Invalid CD key *
     0x201: CD key in use (Additional info field supplies name of user)
     0x202: Banned key
     0x203: Wrong product
     */
    KR_OLD_GAME_VERSION = 256;
    KR_INVALID_VERSION = 257;
    KR_MUST_BE_DOWNGRADED = 258;
    KR_INVALID_CD_KEY = 512; //0x200
    KR_ROC_KEY_IN_USE = 513; //0x201
    KR_TFT_KEY_IN_USE = 529; //0x211
    KR_BANNED_KEY = 514; //0x202
    KR_WRONG_PRODUCT = 515; //0x203

    // KR_GOOD = '\x00\x00\x00\x00';
    // KR_OLD_GAME_VERSION = '\x00\x01\x00\x00';
    // KR_INVALID_VERSION = '\x01\x01\x00\x00';
    // KR_ROC_KEY_IN_USE = '\x01\x02\x00\x00';
    // KR_TFT_KEY_IN_USE = '\x11\x02\x00\x00';

    NULL = '\x00';
    NULL_2 = '\x00\x00';
    NULL_3 = '\x00\x00\x00';
    NULL_4 = '\x00\x00\x00\x00';

    // EID_SHOWUSER = '\x01\x00\x00\x00';
    // EID_JOIN = '\x02\x00\x00\x00';
    // EID_LEAVE = '\x03\x00\x00\x00';
    // EID_WHISPER = '\x04\x00\x00\x00';
    // EID_TALK = '\x05\x00\x00\x00';
    // EID_BROADCAST = '\x06\x00\x00\x00';
    // EID_CHANNEL = '\x07\x00\x00\x00';
    // EID_USERFLAGS = '\x09\x00\x00\x00';
    // EID_WHISPERSENT = '\x0a\x00\x00\x00';
    // EID_CHANNELFULL = '\x0d\x00\x00\x00';
    // EID_CHANNELDOESNOTEXIST = '\x0e\x00\x00\x00';
    // EID_CHANNELRESTRICTED = '\x0f\x00\x00\x00';
    // EID_INFO = '\x12\x00\x00\x00';
    // EID_ERROR = '\x13\x00\x00\x00';
    // EID_EMOTE = '\x17\x00\x00\x00';

    EID_SHOWUSER = 1;	// received when you join a channel (includes users in the channel and their information)
    EID_JOIN = 2;	// received when someone joins the channel you're currently in
    EID_LEAVE = 3;	// received when someone leaves the channel you're currently in
    EID_WHISPER = 4;	// received a whisper message
    EID_TALK = 5;	// received when someone talks in the channel you're currently in
    EID_BROADCAST = 6;	// server broadcast
    EID_CHANNEL = 7;	// received when you join a channel (includes the channel's name, flags)
    EID_USERFLAGS = 9;	// user flags updates
    EID_WHISPERSENT = 10;	// sent a whisper message
    EID_CHANNELFULL = 13;	// channel is full
    EID_CHANNELDOESNOTEXIST = 14;	// channel does not exist
    EID_CHANNELRESTRICTED = 15;	// channel is restricted
    EID_INFO = 18;	// broadcast/information message
    EID_ERROR = 19;	// error message
    EID_EMOTE = 23;	// emote

    CLANRANK_INITIATE = 0;
    CLANRANK_PEON = 1;
    CLANRANK_GRUNT = 2;
    CLANRANK_SHAMAN = 3;
    CLANRANK_CHIEFTAN = 4;

    // Bitfield
    FRIENDSTATUS_MUTUAL = 1;
    FRIENDSTATUS_DND = 2;
    FRIENDSTATUS_AWAY = 4;

    // Value
    FRIENDLOCATION_OFFLINE = 0;
    FRIENDLOCATION_NOTCHAT = 1;
    FRIENDLOCATION_CHAT = 2;
    FRIENDLOCATION_PUB = 3;
    FRIENDLOCATION_PRIVHIDE = 4;
    FRIENDLOCATION_PRIVSHOW = 5;

    PRODUCT_TFT = 'PX3W';
    PRODUCT_ROC = '3RAW';
    PLATFORM_X86 = '68XI';

    receivers;

    constructor(public bnet: BNetConnection) {
        super();

        this.configureReceivers();
    }

    configureReceivers() {
        this.receivers = {};

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
            'SID_FRIENDSADD',
            'SID_GETADVLISTEX'
        ]) {
            this.receivers[this[type].charCodeAt(0)] = this[`RECEIVE_${type}`];
        }
    }

    /**
     * Basic function for construct packets for hosted game
     * @param id Packet type
     * @param args Packet data
     * @returns {Buffer}
     */
    asPacket(id, ...args) {
        return this.buffer(
            this.BNET_HEADER_CONSTANT,
            id,
            ...args
        );
    }

    /**
     * Checks if given buffer a BNet Packet
     * @param {Buffer} buffer
     * @returns {Boolean}
     */
    haveHeader(buffer: Buffer) {
        return String.fromCharCode(buffer[0]) === this.BNET_HEADER_CONSTANT;
    }

    SEND_SID_NULL() {
        return this.asPacket(this.SID_NULL);
    }

    SEND_SID_PING(payload) {
        debug('SEND_SID_PING');
        assert(payload.length === 4, 'invalid parameters passed to SEND_SID_PING');

        return this.asPacket(
            this.SID_PING,
            payload
        );
    }

    SEND_PROTOCOL_INITIALIZE_SELECTOR() {
        debug('SEND_PROTOCOL_INITIALIZE_SELECTOR');

        return Buffer.from(this.INITIALIZE_SELECTOR, 'binary');
    }

    SEND_SID_AUTH_INFO(version, TFT, localeID, countryAbbrev, country, lang) {
        debug('SEND_SID_AUTH_INFO');

        // (DWORD)		 Protocol ID (0)
        // (DWORD)		 Platform ID
        // (DWORD)		 Product ID
        // (DWORD)		 Version Byte
        // (DWORD)		 Product language
        // (DWORD)		 Local IP for NAT compatibility*
        // (DWORD)		 Time zone bias*
        // (DWORD)		 Locale ID*
        // (DWORD)		 Language ID*
        // (STRING) 	 Country abreviation
        // (STRING) 	 Country

        const protocolID = this.NULL_4;
        const language = lang.split('').reverse().join(''); //[83, 85, 110, 101]; // "enUS"
        const IP = localIP().split('.').map(Number); //[127, 0, 0, 1];

        return this.asPacket(
            this.SID_AUTH_INFO,
            protocolID,
            this.PLATFORM_X86,
            TFT ? this.PRODUCT_TFT : this.PRODUCT_ROC,
            ByteUInt32(version),
            language,
            IP,
            ByteUInt32(getTimezone()), //time zone bias
            ByteUInt32(localeID),
            ByteUInt32(localeID),
            ByteString(countryAbbrev),
            ByteString(country)
        );
    }

    SEND_SID_AUTH_CHECK(tft, clientToken, exeVersion, exeVersionHash, keyInfoRoc, keyInfoTft, exeInfo, keyOwnerName) {
        const numKeys = (tft) ? 2 : 1;

        return this.asPacket(
            this.SID_AUTH_CHECK,
            clientToken,
            exeVersion,
            exeVersionHash,
            [numKeys, 0, 0, 0],
            this.NULL_4,
            keyInfoRoc,
            tft ? keyInfoTft : false, //if it false, its excluded
            ByteString(exeInfo),
            ByteString(keyOwnerName)
        );
    }

    SEND_SID_AUTH_ACCOUNTLOGON(clientPublicKey, accountName) {
        assert(clientPublicKey.length === 32, 'public key length error');

        return this.asPacket(
            this.SID_AUTH_ACCOUNTLOGON,
            clientPublicKey,
            ByteString(accountName)
        );
    }

    SEND_SID_AUTH_ACCOUNTLOGONPROOF(M1) {
        assert(M1.length === 20, 'password length error');

        return this.asPacket(
            this.SID_AUTH_ACCOUNTLOGONPROOF,
            M1
        );
    }

    SEND_SID_NETGAMEPORT(serverPort) {
        return this.asPacket(
            this.SID_NETGAMEPORT,
            ByteUInt32(serverPort)
        );
    }

    SEND_SID_ENTERCHAT() {
        return this.asPacket(
            this.SID_ENTERCHAT,
            this.NULL, //account name
            this.NULL //stat string
        );
    }

    SEND_SID_JOINCHANNEL(channel) {
        const noCreateJoin = '\x02\x00\x00\x00';
        const firstJoin = '\x01\x00\x00\x00';

        return this.asPacket(
            this.SID_JOINCHANNEL,
            channel.length > 0 ? noCreateJoin : firstJoin,
            ByteString(channel)
        );
    }

    SEND_SID_CHATCOMMAND(command) {
        return this.asPacket(
            this.SID_CHATCOMMAND,
            ByteString(command)
        );
    }

    SEND_SID_FRIENDSLIST() {
        return this.asPacket(
            this.SID_FRIENDSLIST
        );
    }

    SEND_SID_CLANMEMBERLIST() {
        const cookie = this.NULL_4;

        return this.asPacket(
            this.SID_CLANMEMBERLIST,
            cookie
        );
    }

    SEND_SID_GETADVLISTEX(gameName = '', numGames = 1) {
        let cond1 = [0, 0];
        let cond2 = [0, 0];
        let cond3 = [0, 0, 0, 0];
        let cond4 = [0, 0, 0, 0];

        if (!gameName.length) {
            cond1[0] = 0;
            cond1[1] = 224;

            cond2[0] = 127;
            cond2[1] = 0;
        } else {
            cond1 = [255, 3];
            cond2 = [0, 0];
            cond3 = [255, 3, 0, 0];
            numGames = 1;
        }

        return this.asPacket(
            this.SID_GETADVLISTEX,
            cond1,
            cond2,
            cond3,
            cond4,
            ByteUInt32(numGames),
            ByteString(gameName),
            this.NULL, // Game Password is NULL
            this.NULL // Game Stats is NULL
        );
    }

    SEND_SID_NOTIFYJOIN(gameName) {

    }

    RECEIVE_SID_NULL(buff) {
        debug('RECEIVE_SID_NULL');

        return ValidateLength(buff);
    }

    RECEIVE_SID_GETADVLISTEX(buff) {
        debug('RECEIVE_SID_GETADVLISTEX');
        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> GamesFound
        // if( GamesFound > 0 )
        //		10 bytes			-> ???
        //		2 bytes				-> Port
        //		4 bytes				-> IP
        //		null term string	-> GameName
        //		2 bytes				-> ???
        //		8 bytes				-> HostCounter

        let games = [];

        if (ValidateLength(buff) && buff.length >= 8) {
            let i = 8;
            let gamesFound = buff.readInt32LE(4);

            console.log('gamesFound', gamesFound, buff);

            if (gamesFound > 0 && buff.length >= 25) {
                while (gamesFound > 0) {
                    gamesFound--;

                    if (buff.length < i + 33)
                        break;

                    let gameType = buff.readInt16LE(i);
                    i += 2;
                    let parameter = buff.readInt16LE(i);
                    i += 2;
                    let languageID = buff.readInt32LE(i);
                    i += 4;
                    // AF_INET
                    i += 2;
                    let port = buff.readInt32LE(i);
                    let ip = buff.slice(i, i + 4);
                    i += 4;
                    // zeros
                    i += 4;
                    // zeros
                    i += 4;
                    let status = buff.readInt32LE(i);
                    i += 4;
                    let elapsedTime = buff.readInt32LE(i);
                    i += 4;
                    let gameName = ByteExtractString(buff.slice(i));
                    i += gameName.length + 1;

                    if (buff.length < i + 1)
                        break;

                    let gamePassword = ByteExtractString(buff.slice(i));
                    i += gamePassword.length + 1;

                    if (buff.length < i + 10)
                        break;

                    // SlotsTotal is in ascii hex format
                    let slotsTotal = buff[i];
                    i++;

                    let hostCounterRaw = buff.slice(i, i + 8);
                    let hostCounterString = hostCounterRaw.toString();
                    let hostCounter = 0;

                    //@TODO handle hostCounter from hostCounterString

                    i += 8;
                    let statString = ByteExtractString(buff.slice(i));
                    i += statString.length + 1;

                    games.push(
                        new IncomingGameHost(
                            gameType,
                            parameter,
                            languageID,
                            port,
                            ip,
                            status,
                            elapsedTime,
                            gameName,
                            slotsTotal,
                            hostCounter,
                            statString
                        )
                    );
                }

            }
        }

        return games;

    }

    RECEIVE_SID_AUTH_INFO(buff) {
        debug('RECEIVE_SID_AUTH_INFO');
        assert(ValidateLength(buff) && buff.length >= 25, 'RECEIVE_SID_AUTH_INFO');
        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> LogonType
        // 4 bytes					-> ServerToken
        // 4 bytes					-> UDPValue
        // 8 bytes					-> MPQFileTime
        // null terminated string	-> IX86VerFileName
        // null terminated string	-> ValueStringFormula
        // other bytes              -> ServerSignature

        // (DWORD)		 Logon Type
        // (DWORD)		 Server Token
        // (DWORD)		 UDPValue**
        // (FILETIME)	 MPQ filetime
        // (STRING) 	 IX86ver filename
        // (STRING) 	 ValueString

        const logonType = buff.slice(4, 8), // p[4:8]
            serverToken = buff.slice(8, 12), // p[8:12]
            mpqFileTime = buff.slice(16, 24), // p[16:24]
            ix86VerFileName = ByteExtractString(buff.slice(24)), // p[24:].split(NULL, 1)[0]
            valueString = ByteExtractString(buff.slice(25 + ix86VerFileName.length)); // p[25 + len(ix86VerFileName):].split(this.NULL, 1)[0]

        return {
            logonType,
            serverToken,
            mpqFileTime,
            ix86VerFileName,
            valueString
        } as AuthInfo;
    };

    RECEIVE_SID_PING(buff) {
        debug('RECEIVE_SID_PING');
        assert(buff.length >= 8);

        return buff.slice(4, 8); // bytes(p[4:8])
    };

    RECEIVE_SID_AUTH_CHECK(buff) {
        debug('RECEIVE_SID_AUTH_CHECK');
        assert(ValidateLength(buff) && buff.length >= 9);
        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> KeyState
        // null terminated string	-> KeyStateDescription

        const state = ByteExtractUInt32(buff.slice(4, 8)),
            description = ByteExtractString(buff.slice(8));

        return {state, description} as AuthState;
    };

    RECEIVE_SID_REQUIREDWORK(buff) {
        debug('RECEIVE_SID_REQUIREDWORK');

        return ValidateLength(buff);
    }

    RECEIVE_SID_AUTH_ACCOUNTLOGON(buff) {
        assert(ValidateLength(buff) && buff.length >= 8);

        /**
         * (DWORD)         Status
         * (BYTE[32])     Salt (s)
         * (BYTE[32])     Server Key (B)
         Reports the success or failure of the logon request.
         Possible status codes:
         0x00: Logon accepted, requires proof.
         0x01: Account doesn't exist.
         0x05: Account requires upgrade.
         Other: Unknown (failure).
         */

        const status = buff.readInt32LE(4); //buff.slice(4, 8);
        const salt = buff.slice(8, 40);
        const serverPublicKey = buff.slice(40, 72);

        return {status, salt, serverPublicKey} as AccountLogon;
    }

    RECEIVE_SID_AUTH_ACCOUNTLOGONPROOF(buff: Buffer) {
        debug('RECEIVE_SID_AUTH_ACCOUNTLOGONPROOF');

        assert(ValidateLength(buff) && buff.length >= 8);

        /*
         (DWORD)		 Status
         (BYTE[20])	 Server Password Proof (M2)
         (STRING) 	 Additional information

         This message confirms the validity of the client password proof and supplies the server password proof. See [NLS/SRP Protocol] for more information.

         Status

         0x00: Logon successful.
         0x02: Incorrect password.
         0x0E: An email address should be registered for this account.
         0x0F: Custom error. A string at the end of this message contains the error.
         */

        const status = buff.readInt32LE(4);
        const proof = buff.slice(8, 20);
        const message = ByteExtractString(buff.slice(20 + proof.length));

        return {status, proof, message} as AccountLogonProof;
    }

    RECEIVE_SID_ENTERCHAT(buff) {
        debug('RECEIVE_SID_ENTERCHAT');
        assert(ValidateLength(buff) && buff.length >= 5);

        return buff.slice(4);
    }

    RECEIVE_SID_CHATEVENT(buff) {
        debug('RECEIVE_SID_CHATEVENT');
        assert(ValidateLength(buff) && buff.length >= 29, 'RECEIVE_SID_CHATEVENT');

        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> EventID
        // 4 bytes					-> ???
        // 4 bytes					-> Ping
        // 12 bytes					-> ???
        // null terminated string	-> User
        // null terminated string	-> Message

        const id = buff.readInt32LE(4); //buff.slice(4, 8)
        const ping = buff.readInt32LE(12); //bp.unpack('<I', buff.slice(12, 16)).join('');
        const user = ByteExtractString(buff.slice(28));
        const message = ByteExtractString(buff.slice(29 + user.length));

        return {id, ping, user, message};
    }

    RECEIVE_SID_CHECKAD(buff) {
        debug('RECEIVE_SID_CHECKAD');
    }

    RECEIVE_SID_NETGAMEPORT(buff) {
        debug('RECEIVE_SID_NETGAMEPORT');
    }

    RECEIVE_SID_JOINCHANNEL(buff) {
        debug('RECEIVE_SID_JOINCHANNEL');
    }

    RECEIVE_SID_CHATCOMMAND(buff) {
        debug('RECEIVE_SID_CHATCOMMAND');
    }

    RECEIVE_SID_CLANMEMBERLIST(buff) {
        debug('RECEIVE_SID_CLANMEMBERLIST');
    }

    RECEIVE_SID_CLANMEMBERSTATUSCHANGE(buff) {
        debug('RECEIVE_SID_CLANMEMBERSTATUSCHANGE');
    }

    RECEIVE_SID_CLANINVITATION(buff) {
        debug('RECEIVE_SID_CLANINVITATION');
    }

    RECEIVE_SID_CLANMEMBERREMOVED(buff) {
        debug('RECEIVE_SID_CLANMEMBERREMOVED');
    }

    RECEIVE_SID_STARTADVEX3(buff) {
        debug('RECEIVE_SID_STARTADVEX3');
    }

    RECEIVE_SID_WARDEN(buff) {
        debug('RECEIVE_SID_WARDEN');
    }

    RECEIVE_SID_FRIENDSUPDATE(buff) {
        debug('RECEIVE_SID_FRIENDSUPDATE')
    }

    RECEIVE_SID_FRIENDSLIST(buff) {
        debug('RECEIVE_SID_FRIENDSLIST');
        assert(ValidateLength(buff) && buff.length >= 5, 'RECEIVE_SID_FRIENDSLIST');

        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 1 byte					-> Total
        // for( 1 .. Total )
        //		null term string	-> Account
        //		1 byte				-> Status
        //		1 byte				-> Area
        //		4 bytes				-> ???
        //		null term string	-> Location

        const friends = [];
        let total = buff[4];
        let i = 5;

        while (total > 0) {
            total--;

            if (buff.length < i + 1) {
                break;
            }

            const account = ByteExtractString(buff.slice(i)); //bp.unpack('<S', buff.slice(i))[0];

            i += account.length + 1;

            if (buff.length < i + 7) {
                break;
            }

            const status = buff[i]; //uchar
            const area = buff[i + 1]; //uchar
            const client = buff.slice(i + 2, i + 6).toString().split('').reverse().join(''); //4 chars client

            i += 6;

            const location = ByteExtractString(buff.slice(i)); //bp.unpack('<S', buff.slice(i))[0];
            i += location.length + 1;

            friends.push(new Friend(account, status, area, client, location))
        }

        return friends;
    }

    RECEIVE_SID_FLOODDETECTED(buff) {
        debug('RECEIVE_SID_FLOODDETECTED');
    }

    RECEIVE_SID_CLANINFO(buff) {
        debug('RECEIVE_SID_CLANINFO');
    }

    RECEIVE_SID_MESSAGEBOX(buff) {
        debug('RECEIVE_SID_MESSAGEBOX');
    }

    RECEIVE_SID_FRIENDSADD(buff) {
        debug('RECEIVE_SID_FRIENDSADD');
    }
}
