var rtp;

/**
 * Module dependecies
 */
var dgram = require('dgram'),
	ee = require('events').EventEmitter,
	net = require('net'),
	r = require('./readers.js'),
	xml = require('xml2js'),
	fs = require('fs'),
	udpPort = 41234,
	tempBuffer = null;

rtp = new ee();

var config = {
		port: 22222,
		host: '212.235.190.228',
		version: '1.10',
		byteOrder: 'BE',
		connected: false
};

rtp.parameters = null;

var	udp = dgram.createSocket('udp4', function(err, data){
		rtp.log('Dgram Socket created.', err, data);
	});

var tcp = new net.Socket();
tcp.setNoDelay(true);

/**
 * Config set function
 *
 * @param par config.parameter
 * @param value
 */
rtp.set = function(par, val){
	config[par] = val;
};

rtp.get = function(par){
	return config[par];
};

/**
 * Emit log event
 *
 * @author Andraz <andraz@easistent.com>
 *
 * @return {void}
 */
rtp.log = function () {
    var args = ['log'];
    for(var ii = 0; ii < arguments.length; ii++) {
        args.push(arguments[ii]);
    }

    rtp.emit.apply(rtp, args);
};

/**
 * Auto discover
 *
 * @param
 * @return
 */

rtp.discover = function(cb){
	var packet = new Buffer(10);
	packet.writeInt32LE(10, 0);
	packet.writeInt32LE(7, 4);
	packet.writeUInt16BE(udpPort, 8);
	udp.send(packet, 0, 10, 22226, '127.0.0.1', function(err, bytes){
		rtp.log('UDP Packet Sent', err, bytes);
	});
};

/**
 * Connect to QTM via TCP
 *
 * @param _p User defined port
 * @param _h User defined host
 * @return
 */

rtp.connect = function (_p, _h) {

	if (config.connected) {
		return;
	}

    rtp.log('RTP Connect');

	var port = _p || config.port;
		port++; // Default for LE
	var host = _h || config.host;

	// Set LE or BE
	if(config.byteOrder == 'BE') {
		port++;
    }

	tcp.connect(port, host, function () {
		rtp.log('RTP Connected');
	});
};

/**
 * Disconnect from QTM TCP
 *
 * @author Andraz <andraz@easistent.com>
 *
 * @return {void}
 */
rtp.disconnect = function () {
    rtp.log('RTP Disconnect');
    tcp.end();
    //rtp.emit('disconnected');
};

/**
 * Send Version Command
 *
 * @param _v String
 */

rtp.version = function (_v){
	var version = _v || config.version;
	rtp.command('Version ' + version);
};

/**
 * Send GetCurrentFrame Command
 *
 * @param _o String User defined options
 */

rtp.getCurrentFrame = function (_o){
	var options = _o || '3D';
	rtp.command('GetCurrentFrame ' + options);
};

/**
 * Send GetParameters Command
 *
 * @param _o String User defined options
 */
rtp.getParameters = function (_o){
	var options = _o || 'All';
	rtp.command('GetParameters ' + options);
};

/**
 * Send StreamFrames Command
 *
 * @param _o String User Defined Options
 */
rtp.streamFrames = function (_o){
	var options = _o || 'Frequency:50 3D';
	rtp.command('StreamFrames ' + options);
};

/**
 * Send command
 *
 * @param command String
 * @return
 */

rtp.command = function (command){
	var l = command.length + 8;
	var packet = new Buffer(l);
	packet.writeInt32BE(l, 0);
	packet.writeInt32BE(1, 4); // Command type = 1
	packet.write(command, 8, command.length, 'ASCII');
	tcp.write(packet, 'ASCII', function(){
		rtp.log('Command:    ', command);
	});
};

udp.on('message', function(msg, rinfo){
	var type = msg.readInt32LE(4);
	// Auto discover package
	if(type == 1){
		var port = msg.readUInt16BE(msg.length - 2);
		rtp.log('QTM discoverd on port ' + port);
		// Port -> Base port
		rtp.emit('discover', port);
	}
});

udp.on('error', function(err){
	rtp.log('UDP Error', err);
});

udp.bind(udpPort);

/**
 * Receive Package
 */
tcp.on('data', function(data){
	var self = this;
	var len = data.readInt32BE(0);
	var type = data.readInt32BE(4);
    var out;

	// Check Packet Size
	// TODO: Preveri tudi če je paket večji od len
	if(len != data.length){
		//rtp.log('VELIKOSTI SE NE UJEMAJO!!!!', type, len, data.length);
		if(tempBuffer === null){
			tempBuffer = data;
			return;
		}else{
			var _buf = new Buffer(tempBuffer.length + data.length);
			tempBuffer.copy(_buf);
			data.copy(_buf, tempBuffer.length);
			data = _buf;
			tempBuffer = null;
			// One more check
			len = data.readInt32BE(0);
			if(len != data.length){
				tempBuffer = data;
				return;
			}
			type = data.readInt32BE(4);
		}
	}

	// Error
	if (type === 0) {
		console.log('ERROR!!');
	// Command
	} else if (type === 1) {
		var res = data.toString('ASCII', 8, len-1);
		//res = res.slice(0, res.length-1);

		if (res === 'QTM RT Interface connected') {
			config.connected = true;
			rtp.emit('connect');
		} else if (res === 'Connection refused. Max number of clients reached') {
			rtp.emit('disconnected', res);
		} else {
			rtp.emit('command', res);
			rtp.log('Command Res:', res);

		}
	// XML Packet
	} else if (type === 2) {

		out = data.toString('ASCII', 8, len-1);
        var parser;

        //Write to file
        fs.writeFile('parameters.xml', out, 'ASCII', function (err) {
            if (err) {
                throw err;
            }
            rtp.log('XML\'s saved!');
            //rtp.emit('parameters');
        });

		parser = new xml.Parser(xml.defaults["0.1"]);
		parser.parseString(out, function (err, result) {
			rtp.log('XML\'s parsed!');
			if (err) throw err;
            rtp.parameters = result;
            rtp.emit('parameters', result);
        });
	// Data Packet
	} else if (type === 3) {
		out = r.readDataPacket(data);
		rtp.emit('data', out);
	// No More Data
	} else if (type === 4) {
		rtp.log('No More Data');
	// Events
	} else if (type === 6) {
		/*
		 * TODO: Če je klient stream-a ob RT Start automatsko začni stream
		 */
		out = r.readEventPacket(data);
		var events = [
            'Not Exist 0',
            'Connected',
            'Connection Closed',
            'Capture Started',
            'Capture Stopped',
            'Not Used',
            'Calibration Started',
            'Calibration Stopped',
            'RT From File Started',
            'RT From File Stopped',
            'Waiting for Trigger',
            'Camera Settings Changed',
            'QTM Shutting Down',
            'Capture Saved'
        ];
		rtp.emit('event', out);
		rtp.log('Event:', events[out]);
	} else {
		rtp.log('Unknown Response Type', type);
	}
});

tcp.on('error', function(err){
	rtp.log('TCP Error', err);
});

tcp.on('close', function(had_error) {
    rtp.log('TCP Close', had_error);
    rtp.emit('disconnected');
	//rtp.emit('connect', 'Problem connecting to QTM');
});

tcp.on('end', function(){
    rtp.log('TCP End');
    rtp.emit('disconnected');
});

// custom events listeners on RTP
rtp.on('disconnected', function () {
    if (config.connected === false) {
        return;
    }

    config.connected = false;
    rtp.log('RTP Disconnected');
});


module.exports = rtp;
