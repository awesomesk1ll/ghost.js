'use strict';

var util = require('util');
var Bytes = require('../Bytes');
var bp = require('bufferpack');
var fs = require('fs');
var path = require('path');

import {create} from '../Logger';
const {debug, info, error} = create('Map');
import {BytesExtract} from '../Bytes';
import GameSlot from './GameSlot';

export default class Map {
	static SPEED_SLOW = 1;
	static SPEED_NORMAL = 2;
	static SPEED_FAST = 3;
	static VIS_HIDETERRAIN = 1;
	static VIS_EXPLORED = 2;
	static VIS_ALWAYSVISIBLE = 3;
	static VIS_DEFAULT = 4;
	static OBS_NONE = 1;
	static OBS_ONDEFEAT = 2;
	static OBS_ALLOWED = 3;
	static OBS_REFEREES = 4;
	static FLAG_TEAMSTOGETHER = 1;
	static FLAG_FIXEDTEAMS = 2;
	static FLAG_UNITSHARE = 4;
	static FLAG_RANDOMHERO = 8;
	static FLAG_RANDOMRACES = 16;
	static OPT_HIDEMINIMAP = 1 << 0;
	static OPT_MODIFYALLYPRIORITIES = 1 << 1;
	static OPT_MELEE = 1 << 2;		// the bot cares about this one...
	static OPT_REVEALTERRAIN = 1 << 4;
	static OPT_FIXEDPLAYERSETTINGS = 1 << 5;
	// and this one...
	static OPT_CUSTOMFORCES = 1 << 6;
	// and this one the rest don't affect the bot's logic
	static OPT_CUSTOMTECHTREE = 1 << 7;
	static OPT_CUSTOMABILITIES = 1 << 8;
	static OPT_CUSTOMUPGRADES = 1 << 9;
	static OPT_WATERWAVESONCLIFFSHORES = 1 << 11;
	static OPT_WATERWAVESONSLOPESHORES = 1 << 12;
	static FILTER_MAKER_USER = 1;
	static FILTER_MAKER_BLIZZARD = 2;
	static FILTER_TYPE_MELEE = 1;
	static FILTER_TYPE_SCENARIO = 2;
	static FILTER_SIZE_SMALL = 1;
	static FILTER_SIZE_MEDIUM = 2;
	static FILTER_SIZE_LARGE = 4;
	static FILTER_OBS_FULL = 1;
	static FILTER_OBS_ONDEATH = 2;
	static FILTER_OBS_NONE = 4;
	static TYPE_UNKNOWN0 = 1;
	// always set except for saved games?
	// AuthenticatedMakerBlizzard = 1 << 3
	// OfficialMeleeGame = 1 << 5
	static TYPE_SAVEDGAME = 1 << 9;
	static TYPE_PRIVATEGAME = 1 << 11;
	static TYPE_MAKERUSER = 1 << 13;
	static TYPE_MAKERBLIZZARD = 1 << 14;
	static TYPE_TYPEMELEE = 1 << 15;
	static TYPE_TYPESCENARIO = 1 << 16;
	static TYPE_SIZESMALL = 1 << 17;
	static TYPE_SIZEMEDIUM = 1 << 18;
	static TYPE_SIZELARGE = 1 << 19;
	static TYPE_OBSFULL = 1 << 20;
	static TYPE_OBSONDEATH = 1 << 21;
	static TYPE_OBSNONE = 1 << 22;

	constructor(path) {
		this.gameFlags = 0;
		this.slots = [];

		if (!this.load(path)) {
			this.loadDefaultMap();
		}
	}

	loadDefaultMap() {
		this.valid = true;
		this.mapPath = 'Maps\\FrozenThrone\\(12)EmeraldGardens.w3x';
		this.mapSize = BytesExtract('174 221 4 0', 4);
		this.mapInfo = BytesExtract('251 57 68 98', 4);
		this.mapCRC = BytesExtract('108 250 204 59', 4);
		this.mapSHA1 = BytesExtract('35 81 104 182 223 63 204 215 1 17 87 234 220 66 3 185 82 99 6 13', 20);

		info('using hardcoded Emerald Gardens map data for Warcraft 3 version 1.24 & 1.24b');

		this.SPEED = Map.SPEED_FAST;
		this.VISibility = Map.VIS_DEFAULT;
		this.OBServers = Map.OBS_NONE;
		this.FLAGs = Map.FLAG_TEAMSTOGETHER | Map.FLAG_FIXEDTEAMS;
		this.FILTERMarker = Map.FILTER_MAKER_BLIZZARD;
		this.FILTERType = Map.FILTER_TYPE_MELEE;
		this.FILTERSize = Map.FILTER_SIZE_LARGE;
		this.FILTERObs = Map.FILTER_OBS_NONE;
		this.OPTions = Map.OPT_MELEE;

		this.mapWidth = BytesExtract('172 0', 2);
		this.mapHeight = BytesExtract('172 0', 2);

		this.mapNumPlayer = 12;
		this.mapNumTeams = 1;

		const slots = [
			[0, 255, GameSlot.STATUS_OPEN, 0, 0, 0, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 1, 1, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 2, 2, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 3, 3, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 4, 4, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 5, 5, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 6, 6, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 7, 7, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 8, 8, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 9, 9, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 10, 10, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE],
			[0, 255, GameSlot.STATUS_OPEN, 0, 11, 11, GameSlot.RACE_RANDOM | GameSlot.RACE_SELECTABLE]
		];

		for (let slot of slots) {
			this.slots.push(new GameSlot(...slot));
		}
	}

	load(filepath) {
		if (!fs.existsSync(filepath)) {
			throw new Error(`Failed to load map from ${filepath}`);
		}

		const file = JSON.parse(fs.readFileSync(filepath, 'utf8'));

		this.valid = true;
		this.mapPath = file.path;
		this.mapSize = Array.isArray(file.size) ? Buffer.from(file.size) : BytesExtract(file.size, 4);
		this.mapInfo = Array.isArray(file.info) ? Buffer.from(file.info) : BytesExtract(file.info, 4);
		this.mapCRC = Array.isArray(file.crc) ? Buffer.from(file.crc) : BytesExtract(file.crc, 4);
		this.mapSHA1 = Array.isArray(file.sha1) ? Buffer.from(file.sha1) : BytesExtract(file.sha1, 20);

		debug('Map', 'using loaded', this.mapPath);

		this.SPEED = file.speed;
		this.VISibility = file.visibility;
		this.OBServers = file.observers;
		this.FLAGs = file.flags;
		this.FILTERMarker = Map.FILTER_MAKER_BLIZZARD;
		this.FILTERType = Map.FILTER_TYPE_MELEE;
		this.FILTERSize = Map.FILTER_SIZE_LARGE;
		this.FILTERObs = Map.FILTER_OBS_NONE;
		this.OPTions = Map.OPT_MELEE;

		this.mapWidth = Array.isArray(file.width) ? new Buffer(file.width) : BytesExtract(file.width, 2);
		this.mapHeight = Array.isArray(file.height) ? new Buffer(file.height) : BytesExtract(file.height, 2);

		this.mapNumPlayer = file.players;
		this.mapNumTeams = file.teams;

		if (Array.isArray(file.slots)) {
			for (let slot of file.slots) {
				this.slots.push(new GameSlot(...slot));
			}
		}
	}

	getSlots() {
		return this.slots;
	}

	getGameFlags() {
		/*
		 Speed: (mask 0x00000003) cannot be combined
		 0x00000000 - Slow game speed
		 0x00000001 - Normal game speed
		 0x00000002 - Fast game speed
		 Visibility: (mask 0x00000F00) cannot be combined
		 0x00000100 - Hide terrain
		 0x00000200 - Map explored
		 0x00000400 - Always visible (no fog of war)
		 0x00000800 - Default
		 Observers/Referees: (mask 0x40003000) cannot be combined
		 0x00000000 - No Observers
		 0x00002000 - Observers on Defeat
		 0x00003000 - Additional players as observer allowed
		 0x40000000 - Referees
		 Teams/Units/Hero/Race: (mask 0x07064000) can be combined
		 0x00004000 - Teams Together (team members are placed at neighbored starting locations)
		 0x00060000 - Fixed teams
		 0x01000000 - Unit share
		 0x02000000 - Random hero
		 0x04000000 - Random races
		 */

		this.gameFlags = 0;

		// speed
		switch (this.SPEED) {
			case Map.SPEED_SLOW:
				this.gameFlags = 0x00000000;
				break;
			case Map.SPEED_NORMAL:
				this.gameFlags = 0x00000001;
				break;
			default:
				this.gameFlags = 0x00000002;
				break;
		}

		// visibility
		switch (this.VISibility) {
			case Map.VIS_HIDETERRAIN:
				this.gameFlags |= 0x00000100;
				break;
			case Map.VIS_EXPLORED:
				this.gameFlags |= 0x00000200;
				break;
			case Map.VIS_ALWAYSVISIBLE:
				this.gameFlags |= 0x00000400;
				break;
			default:
				this.gameFlags |= 0x00000800;
		}

		// observers
		switch (this.OBServers) {
			case Map.OBS_ONDEFEAT:
				this.gameFlags |= 0x00002000;
				break;
			case Map.OBS_ALLOWED:
				this.gameFlags |= 0x00003000;
				break;
			case Map.OBS_REFEREES:
				this.gameFlags |= 0x40000000;
				break;
		}

		if (this.FLAGs & Map.FLAG_TEAMSTOGETHER) {
			this.gameFlags |= 0x00004000;
		}
		if (this.FLAGs & Map.FLAG_FIXEDTEAMS) {
			this.gameFlags |= 0x00060000;
		}
		if (this.FLAGs & Map.FLAG_UNITSHARE) {
			this.gameFlags |= 0x01000000;
		}
		if (this.FLAGs & Map.FLAG_RANDOMHERO) {
			this.gameFlags |= 0x02000000;
		}
		if (this.FLAGs & Map.FLAG_RANDOMRACES) {
			this.gameFlags |= 0x04000000;
		}

		return bp.pack('<I', this.gameFlags);
	}

	getWidth() {
		return this.mapWidth;
	}

	getHeight() {
		return this.mapHeight;
	}

	getPath() {
		return this.mapPath;
	}

	getCRC() {
		return this.mapCRC;
	}
}