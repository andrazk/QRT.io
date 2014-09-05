var Int64 = require('int64-native');

var readers = {};
/**
 * Read Data Packet
 *
 * @param data Buffer
 */
readers.readDataPacket = function(data){
    var size = data.readInt32BE(0);
    var type = data.readInt32BE(4);
    var timestamp = parseInt(new Int64('0x' + data.toString('hex', 8, 16)), 10);
    var framenumber = data.readInt32BE(16);
    var componentsCount = data.readInt32BE(20);

    var out = {
        size: size,
        type: type,
        timestamp: timestamp,
        frameNo: framenumber,
        componentsCount: componentsCount,
        components: readers.readComponents(data.slice(24), componentsCount)
    };

    return out;
};

/**
 * Read Components Chunk
 *
 * @param data Buffer
 */
readers.readComponents = function(data, count) {

    var ii;
    var out = [];
    var offset = 0;
    var possibleTypes = [1, 2, 9, 10];
    var size;
    var type;

    for (ii = 0; ii < count; ii++) {

        size = data.readInt32BE(offset);
        offset += 4;
        type = data.readInt32BE(offset);
        offset += 4;

        // TODO: Interpret All Components Type
        // 3D component
        if (possibleTypes.indexOf(type) >= 0) {
            out.push(readers.read3DComponent(data.slice(offset, size), size, type));
        }

        offset += size - 8;
    }

    return out;
};

/**
 * readMarkers from 3D Component
 *
 * @param  {buffer} data to read from
 * @param  {integer} offset whre to start reading
 * @param  {integer} count number of markers
 *
 * @return {mixed}
 */
readers.readMarkers = function (data, offset, count, type) {

    var ii;
    var markers = [];

    for (ii = 0; ii < count; ii++) {

        markers[ii] = {
            x: data.readFloatBE(offset),
            y: data.readFloatBE(offset + 4),
            z: data.readFloatBE(offset + 8)
        };

        offset += 12;

        if (type === 2 || type === 10) {
            markers[ii].ID = data.readInt32BE(offset);
            offset += 4;
        } else if (type === 9 || type === 10) {
            markers[ii].residual = data.readFloatBE(offset);
            offset += 4;
        }
    }

    return markers;
};

/**
 * Read 3D Component
 *
 * @param data Buffer
 */
readers.read3DComponent = function (data, size, type) {

    var offset = 0;
    var count = data.readInt32BE(offset);
    offset += 4;
    var dr = data.readInt16BE(offset);
    offset += 2;
    var oosr = data.readInt16BE(offset);
    offset += 2;

    return {
        type: type,
        count: count,
        name: '3D Component',
        dr: dr, // 2D Drop Rate
        oosr: oosr, // 2D Out Of Sync Rate
        markers: readers.readMarkers(data, offset, count, type)
    };
};

/**
 * Read Event Data Packet
 *
 * @param data buffer
 */
readers.readEventPacket = function(data){
    var event = data.readInt8(8);

    return event;

};

module.exports = readers;
