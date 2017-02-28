'use strict';

/**
 * @param {Number} type
 * @param {Number} id
 * @param {Buffer} buffer
 * @constructor
 */
export class CommandPacket {
	constructor(type, id, buffer) {
		this.type = type;
		this.id = id;
		this.buffer = buffer;
	}
}