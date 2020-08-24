'use strict';

import {ByteArray, ByteString, AssignLength, ValidateLength, ByteUInt32, ByteUInt16, encodeStatString} from './../Bytes';
import {Protocol} from '../Protocol';
import {IncomingJoinPlayer} from './IncomingJoinPlayer';
import {GameSlot} from './GameSlot';
import * as bp from 'bufferpack';
import {getTicks, getTime} from '../util';
import {createLoggerFor, hex} from '../Logger';
import {Game} from "./Game";
import {BNET_HEADER_CONSTANT} from "../bnet/BNetProtocol";

const {debug, info, error} = createLoggerFor('GameProtocol');

export class GameProtocol extends Protocol {

    W3GS_HEADER_CONSTANT = 247;

    GAME_NONE = 0;
    GAME_FULL = 2;

    GAME_PUBLIC = 16;
    GAME_PRIVATE = 17;

    GAMETYPE_CUSTOM = 1;
    GAMETYPE_BLIZZARD = 9;

    PLAYERLEAVE_DISCONNECT = 1;
    PLAYERLEAVE_LOST = 7;
    PLAYERLEAVE_LOSTBUILDINGS = 8;
    PLAYERLEAVE_WON = 9;
    PLAYERLEAVE_DRAW = 10;
    PLAYERLEAVE_OBSERVER = 11;
    PLAYERLEAVE_LOBBY = 13;
    PLAYERLEAVE_GPROXY = 100;

    REJECTJOIN_FULL = 9;
    REJECTJOIN_STARTED = 10;
    REJECTJOIN_WRONGPASSWORD = 27;

    W3GS_PING_FROM_HOST = 1;	// 0x01
    W3GS_SLOTINFOJOIN = 4;	// 0x04
    W3GS_REJECTJOIN = 5;	// 0x05
    W3GS_PLAYERINFO = 6;	// 0x06
    W3GS_PLAYERLEAVE_OTHERS = 7;	// 0x07
    W3GS_GAMELOADED_OTHERS = 8;	// 0x08
    W3GS_SLOTINFO = 9;	// 0x09
    W3GS_COUNTDOWN_START = 10;	// 0x0A
    W3GS_COUNTDOWN_END = 11;	// 0x0B
    W3GS_INCOMING_ACTION = 12;	// 0x0C
    W3GS_CHAT_FROM_HOST = 15;	// 0x0F
    W3GS_START_LAG = 16;	// 0x10
    W3GS_STOP_LAG = 17;	// 0x11
    W3GS_HOST_KICK_PLAYER = 28;	// 0x1C
    W3GS_REQJOIN = 30;	// 0x1E
    W3GS_LEAVEGAME = 33;	// 0x21
    W3GS_GAMELOADED_SELF = 35;	// 0x23
    W3GS_OUTGOING_ACTION = 38;	// 0x26
    W3GS_OUTGOING_KEEPALIVE = 39;	// 0x27
    W3GS_CHAT_TO_HOST = 40;	// 0x28
    W3GS_DROPREQ = 41;	// 0x29
    W3GS_SEARCHGAME = 47;	// 0x2F (UDP/LAN)
    W3GS_GAMEINFO = 48;	// 0x30 (UDP/LAN)
    W3GS_CREATEGAME = 49;	// 0x31 (UDP/LAN)
    W3GS_REFRESHGAME = 50;	// 0x32 (UDP/LAN)
    W3GS_DECREATEGAME = 51;	// 0x33 (UDP/LAN)
    W3GS_CHAT_OTHERS = 52;	// 0x34
    W3GS_PING_FROM_OTHERS = 53;	// 0x35
    W3GS_PONG_TO_OTHERS = 54;	// 0x36
    W3GS_MAPCHECK = 61;	// 0x3D
    W3GS_STARTDOWNLOAD = 63;	// 0x3F
    W3GS_MAPSIZE = 66;	// 0x42
    W3GS_MAPPART = 67;	// 0x43
    W3GS_MAPPARTOK = 68;	// 0x44
    W3GS_MAPPARTNOTOK = 69;	// 0x45 - just a guess; received this packet after forgetting to send a crc in W3GS_MAPPART (f7 45 0a 00 01 02 01 00 00 00)
    W3GS_PONG_TO_HOST = 70;	// 0x46
    W3GS_INCOMING_ACTION2 = 72;	// 0x48 - received this packet when there are too many actions to fit in W3GS_INCOMING_ACTION

    NULL = '\x00';
    NULL_2 = '\x00\x00';
    NULL_3 = '\x00\x00\x00';
    NULL_4 = '\x00\x00\x00\x00';

    PRODUCT_TFT = 'PX3W';
    PRODUCT_ROC = '3RAW';
    PLATFORM_X86 = '68XI';

    private receivers = {};

    constructor(public game: Game) {
        super();
    }

    /**
     * Basic function for construct packets for hosted game
     * @param id Packet type
     * @param args Packet data
     * @returns {Buffer}
     */
    asPacket(id, ...args) {
        return this.buffer(
            this.W3GS_HEADER_CONSTANT,
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
        return buffer[0] === this.W3GS_HEADER_CONSTANT
    }

    /**
     *
     * @param slots
     * @param randomSeed
     * @param layoutStyle
     * @param playerSlots
     * @returns {Buffer}
     */
    encodeSlotInfo(slots, /*uint32*/ randomSeed: number, /*uchar*/layoutStyle: string, /*uchar*/playerSlots: string) {
        var slotInfo = [
            slots.length
        ];

        for (var i = 0; i < slots.length; ++i) {
            slotInfo.push(slots[i].toBuffer());
        }

        slotInfo.push(ByteUInt32(randomSeed));
        slotInfo.push(layoutStyle);
        slotInfo.push(playerSlots);

        return ByteArray(slotInfo);
    }

    /**
     * @param {Array} data
     * @returns {Array}

     unsigned char Mask = 1;
     BYTEARRAY Result;

     for( unsigned int i = 0; i < data.size( ); ++i )
     {
        if( ( data[i] % 2 ) == 0 )
            Result.push_back( data[i] + 1 );
        else
        {
            Result.push_back( data[i] );
            Mask |= 1 << ( ( i % 7 ) + 1 );
        }

        if( i % 7 == 6 || i == data.size( ) - 1 )
        {
            Result.insert( Result.end( ) - 1 - ( i % 7 ), Mask );
            Mask = 1;
        }
    }

     return Result;
     */
    encodeStatString(data: Buffer) {
        return encodeStatString(data);
    }

    SEND_W3GS_PING_FROM_HOST() {
        return this.asPacket(
            this.W3GS_PING_FROM_HOST,
            getTicks()
        );
    }

    SEND_W3GS_SLOTINFOJOIN(/*unsigned char*/ PID: string,
                           /*BYTEARRAY*/ port: Buffer,
                           /*BYTEARRAY*/ externalIP: Buffer,
                           /*vector<CGameSlot> &*/slots: GameSlot[],
                           /*uint32_t*/ randomSeed: number,
                           /*unsigned char*/ layoutStyle: string,
                           /*unsigned char*/ playerSlots: string) {

        const zeros = this.NULL_4;
        const slotInfo = this.encodeSlotInfo(slots, randomSeed, layoutStyle, playerSlots);

        if (port.length === 2 && externalIP.length === 4) {
            return this.asPacket(
                this.W3GS_SLOTINFOJOIN,
                ByteUInt32(slotInfo.length),
                slotInfo,
                PID,
                [2, 0], //AF_INET
                port,
                externalIP,
                zeros,
                zeros
            );
        } else {
            error('invalid parameters passed to SEND_W3GS_SLOTINFOJOIN');
        }
    }

    SEND_W3GS_REJECTJOIN(/* uint32 */ reason) {
        return this.buffer(
            this.W3GS_REJECTJOIN,
            reason
        );
    }

    SEND_W3GS_PLAYERINFO() {
    }

    SEND_W3GS_PLAYERLEAVE_OTHERS() {
    }

    SEND_W3GS_GAMELOADED_OTHERS() {
    }

    SEND_W3GS_SLOTINFO() {
    }

    SEND_W3GS_COUNTDOWN_START() {
    }

    SEND_W3GS_COUNTDOWN_END() {
    }

    SEND_W3GS_INCOMING_ACTION() {
    }

    SEND_W3GS_CHAT_FROM_HOST() {
    }

    SEND_W3GS_START_LAG() {
    }

    SEND_W3GS_STOP_LAG() {
    }

    SEND_W3GS_SEARCHGAME() {
    }

    SEND_W3GS_GAMEINFO(
        TFT: boolean,
        war3Version: string,
        mapGameType: Buffer,
        mapFlags: Buffer,
        mapWidth: Buffer,
        mapHeight: Buffer,
        gameName: string,
        hostName: string,
        upTime: number,
        mapPath: string,
        mapCRC: Buffer,
        slotsTotal: number,
        slotsOpen: number,
        port: number,
        hostCounter: number
    ) {
        const ProductID_ROC = [51, 82, 65, 87];	// "WAR3"
        const ProductID_TFT = [80, 88, 51, 87];	// "W3XP"

        if (mapGameType.length !== 4) {
            throw 'map game type length invalid, 4 expected';
        }

        if (mapFlags.length !== 4) {
            throw 'map flags length invalid, 4 expected';
        }

        if (mapWidth.length !== 2) {
            throw 'map width length invalid, 2 expected';
        }

        if (mapHeight.length !== 2) {
            throw 'map height length invalid, 2 expected';
        }

        if (mapCRC.length !== 4) {
            throw 'map crc checksumm length invalid, 4 expected';
        }

        if (gameName && hostName && mapPath) {
            const statArray = [
                mapFlags,
                0, //filled in encodeStatString
                mapWidth,
                mapHeight,
                mapCRC,
                ByteString(mapPath),
                ByteString(hostName),
                0 //filled in encodeStatString
            ];

            const statBuffer = encodeStatString(ByteArray(statArray));

            const buffer = this.asPacket(
                this.W3GS_GAMEINFO,
                TFT ? ProductID_TFT : ProductID_ROC,
                [Number(war3Version), 0, 0, 0],
                ByteUInt32(hostCounter),
                ByteUInt32(0), // EntryKey
                ByteString(gameName),
                0, // password ?
                statBuffer,
                0, // Stat String null terminator (the stat string is encoded to remove all even numbers i.e. zeros)
                ByteUInt32(slotsTotal),
                mapGameType,
                [1, 0, 0, 0], //unknown2
                ByteUInt32(slotsOpen),
                ByteUInt32(upTime),
                ByteUInt16(port)
            );

            if (buffer.length > 166) {
                error('erro bytes to big', buffer.length);
            }

            return buffer;
        } else {
            error('invalid parameters passed to SEND_W3GS_GAMEINFO');
        }

    }

    SEND_W3GS_CREATEGAME() {
    }

    SEND_W3GS_REFRESHGAME() {
    }

    SEND_W3GS_DECREATEGAME() {
    }

    RECEIVE_W3GS_REQJOIN(buffer) {
        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> Host Counter (Game ID)
        // 4 bytes					-> Entry Key (used in LAN)
        // 1 byte					-> ???
        // 2 bytes					-> Listen Port
        // 4 bytes					-> Peer Key
        // null terminated string	-> Name
        // 4 bytes					-> ???
        // 2 bytes					-> InternalPort (???)
        // 4 bytes					-> InternalIP

        debug('RECEIVE_W3GS_REQJOIN');
        hex(buffer);

        if (ValidateLength(buffer) && buffer.length >= 20) {
            const hostCounter = bp.unpack('<I', buffer, 4)[0];
            const entryKey = bp.unpack('<I', buffer, 8)[0];
            const name = bp.unpack('<S', buffer, 19)[0];

            if (name.length && buffer.length >= name.length + 30) {
                const internalIPBuffer = buffer.slice(name.length + 26, name.length + 30);
                return new IncomingJoinPlayer(hostCounter, entryKey, name, internalIPBuffer);
            }
        }
    }

    RECEIVE_W3GS_LEAVEGAME() {
        // 2 bytes					-> Header
        // 2 bytes					-> Length
        // 4 bytes					-> Reason

        debug('RECEIVE_W3GS_LEAVEGAME');
    }

    RECEIVE_W3GS_GAMELOADED_SELF() {
        debug('RECEIVE_W3GS_GAMELOADED_SELF');
    }

    RECEIVE_W3GS_OUTGOING_ACTION() {
        debug('RECEIVE_W3GS_OUTGOING_ACTION');
    }

    RECEIVE_W3GS_OUTGOING_KEEPALIVE() {
        debug('RECEIVE_W3GS_OUTGOING_KEEPALIVE');
    }

    RECEIVE_W3GS_CHAT_TO_HOST() {
        debug('RECEIVE_W3GS_CHAT_TO_HOST');
    }

    RECEIVE_W3GS_SEARCHGAME() {
        debug('RECEIVE_W3GS_SEARCHGAME');
    }

    RECEIVE_W3GS_MAPSIZE() {
        debug('RECEIVE_W3GS_MAPSIZE');
    }

    RECEIVE_W3GS_MAPPARTOK() {
        debug('RECEIVE_W3GS_MAPPARTOK');
    }

    RECEIVE_W3GS_PONG_TO_HOST() {
        debug('RECEIVE_W3GS_PONG_TO_HOST');
    }
}
