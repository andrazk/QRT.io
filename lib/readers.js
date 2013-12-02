var readers = {}
/**
 * Read Data Packet
 * 
 * @param data Buffer
 */
readers.readDataPacket = function(data){
	var len = data.readInt32BE(0);
	var type = data.readInt32BE(4);
	var out = {
			timestamp: data.readDoubleBE(8), // FIXME: Int64 namesto Double
			frameNo: data.readInt32BE(16), 
			components: readers.readComponents(data.slice(20, len))
	}	
	
	return out;
}

/**
 * Read Components Chunk
 * 
 * @param data Buffer
 */
readers.readComponents = function(data){
	var count = data.readInt32BE(0);
	var out = [];
	var type3D = [1, 2, 9, 10];
	
	var len, type;
	var offset = 4;
	for(var i = 0; i < count; i++){
		len = data.readInt32BE(offset);
		type = data.readInt32BE(offset + 4);
		
		// TODO: Interpret All Components Type
		// 3D component
		if(type3D.indexOf(type) >= 0){
			out[i] = readers.read3DComponent(data.slice(offset, offset + len));
		}
		
	}
	return out;
}

/**
 * Read 3D Component
 * 
 * @param data Buffer
 * @param _l Int 
 * @param _t Int
 */
readers.read3DComponent = function(data, _l, _t){
	var len = _l || data.readInt32BE(0);
	var type = _t || data.readInt32BE(4);
	var count = data.readInt32BE(8);
	var out = {
		type: type,
		count: count,
		name: '3D Component',
		dr: data.readInt16BE(12), // 2D Drop Rate
		oosr: data.readInt16BE(14), // 2D Out Of Sync Rate
		markers: []
	}
	
	var offset = 16;
	for(var i = 0; i < count; i++){
		out.markers[i] = {
				x: data.readFloatBE(offset),
				y: data.readFloatBE(offset + 4),
				z: data.readFloatBE(offset + 8)
		}
		offset += 12;
		if(type == 2 || type == 10){
			out.markers[i].ID = data.readInt32BE(offset);
			offset += 4;
		}
		if(type == 9 || type == 10){
			out.markers[i].residual = data.readInt32BE(offset);
			offset += 4;
		}
		
	}
	
	return out;
}

/**
 * Read Event Data Packet
 * 
 * @param data buffer
 */
readers.readEventPacket = function(data){
	var event = data.readInt8(8);
	
	return event;
	
}

module.exports = readers;