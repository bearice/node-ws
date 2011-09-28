var util   = require('util'),
    events = require("events");

var WSPV8 = require("./wspv8");

var WSProtocolHandler = {
    "8":WSPV8.ProtocolHander,
};

function writeHeader(socket,code,headers,callback){
    var response = "HTTP/1.1 "+code+"\r\n";
    if(!headers["Server"])headers["Server"]="KumaAccel/1.0";
    for(k in headers){
        response += k + ": " + headers[k] + "\r\n";
    }
    response += "\r\n";
    socket.write(response,'utf8',callback);
};

function WSConnBase(){
    this.writeHeader = function (code,headers,callback){
        writeHeader(this.socket,code,headers,callback);
    };
    this.write = function (packet){
        if(typeof(packet)=='string'){
            packet = new Buffer(packet);
        }
        packet = this.handler.encodePacket(packet);
        return this.socket.write(packet);
    };
}

util.inherits(WSConnBase,events.EventEmitter);

/**
 * events:
 *  data - function(data){} - emit when new piece of data arrived
 *  error - function(error){} - emit on error
 *  close - function(){} - emit when client socket closed.
 *
 * methods:
 *  write(data) - write data to client, data can be a string or buffer, when data is a string, message will be encoded using utf8
 *  writeHeader(code,headers,callback) - write a HTTP Header to client. can be used when init function decided to refuse this connection
 *
 * properties:
 *  socket - client socket
 *  req - HTTP Request
 *  handler - WSProtocol Handler
 */
function WSConnection(req,socket,handler){
    this.req     = req;
    this.socket  = socket;
    this.handler = handler;
}

WSConnection.prototype = new WSConnBase();

/**
 * arguments:
 *  init - function(conn) => bool - called when new connection arrives, return false if you do not want this connection
 */
function WebSocket(init){
    return function(req,socket,head){
        var WSVer = req.headers["sec-websocket-version"];
        if(!WSVer || ! WSProtocolHandler[WSVer]){
            console.error("unknown protocol version:",WSVer);
            writeHeader(socket,"400 Bad Request",{
                "X-Server-Error":"Unknown protocol version"   
            },function(){
                socket.destroy();
            });
            return;
        }

        var handler = new WSProtocolHandler[WSVer]();
        var conn    = new WSConnection(req,socket,handler);
        var buffer  = null;

        function onData(data){
            function packetHandler(data){
                conn.emit("data",data);
            }
            if(buffer){
                var newbuf = new Buffer(buffer.length+data.length);
                buffer.copy(newbuf);
                data.copy(newbuf,buffer.length);
                buffer = newbuf;
            }else{
                buffer = data;
            }
            var buflen = buffer.length;
            var ret;
            while((ret = handler.decodePacket(buffer,packetHandler))>0){
                buffer = buffer.slice(ret);
            };
            if(buffer.length==0){
                buffer = null;
            }else if(buffer.length < buflen/2){
                var newbuf = new Buffer(buffer.length);
                buffer.copy(newbuf);
                buffer = newbuf;
            }
        }

        function onError(err){
            conn.emit("error",err);
            socket.destroy();
        }

        function onClose(){
            conn.emit("close");
        }

        function initSocket(){
            socket.on('data' ,onData);
            socket.on('error',onError);
            socket.on('end'  ,onClose);
            socket.on('close',onClose);
        }

        if(init(conn) == false){
            return;    
        }

        if(handler.handshake(conn,head,initSocket) == false){
            writeHeader(socket,"400 Bad Request",{
                "X-Server-Error":"Protocol handshake failed"   
            });
            onError(new Error("handshake failed"));
            return;
        }
    };
};

exports.WebSocket = WebSocket;

