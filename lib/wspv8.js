// WebSocket Protocol Version 8 Handler
// See http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-12
var crypto = require('crypto');
function ProtocolHander(){}
ProtocolHander.prototype = {
    handshake:function(conn,head,callback){
        var key = conn.req.headers["sec-websocket-key"];
        if(!key)return false;
        key += "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        var sha1 = crypto.createHash('sha1');
        sha1.update(key);
        var hash = sha1.digest('base64');
        console.log(key,hash);
        conn.writeHeader("101 WebSocket Protocol Handshake",
        {
            "Upgrade": "WebSocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Accept":hash,
        },callback);
        return true;
    },
    decodePacket:function(buffer,callback){
        if(buffer.length<2)return 0;
        var offset = 0;
        var fin,op,mask,len,key,data;
        var tmp = buffer.readUInt8(offset++);
        fin = tmp >> 7;
        op = tmp & 0x0F;
        tmp = buffer.readUInt8(offset++);
        mask = tmp >>7;
        len = tmp & 0x7F;
        if(len==126){
            if(buffer.length-offset<2)return 0;
            len = buffer.readUInt16BE(offset);
            offset += 2;
        }else if(len == 127){
            if(buffer.length-offset<8)return 0;
            // Note: due to leak of 64bit integer support, read only low 32bits of length here.
            offset += 4
            len = buffer.readUInt32BE(offset);
            offset += 4;
        }
//            console.info("fin   : "+fin);
//            console.info("op    : "+op);
//            console.info("mask  : "+mask);
//            console.info("length: "+len);
        if(mask){
            if(buffer.length-offset<4)return 0;
            key = buffer.readUInt32BE(offset);
            offset += 4;
        }
        if(buffer.length-offset<len)return 0;
        buffer = buffer.slice(offset,offset+len);
        if(key!=undefined){
            this.mask(buffer,key);
        }
        callback(buffer);
        return offset+len;
    },
    mask: function(buffer,key){
        var offset = 0;
        while(offset+4<buffer.length){
            var val = buffer.readUInt32BE(offset);
            val = val ^ key;
            buffer.writeUInt32BE(val,offset);
            offset += 4;
        }
        if(offset==buffer.length)return;
        var tmpBuf = new Buffer(4);
        tmpBuf.writeUInt32BE(key,0);
        while(offset<buffer.length){
            var val = buffer.readUInt8(offset);
            key = tmpBuf.readUInt8(offset%4);
            val = val ^ key;
            buffer.writeUInt8(val,offset);
            offset ++;
        }
    },
    encodePacket:function(packet){
        var len = 2;
        if(packet.length>0xFFFF){
            len += 8;
        }else if(packet.length>126){
            len += 2;
        }
        len += packet.length;
        var ret = new Buffer(len);
        len = 0;
        ret.writeUInt8(0x81,len++);
        if(packet.length>0xFFFF){
            ret.writeUInt8(127,len++);
            ret.writeUInt32BE(0,len);
            ret.writeUInt32BE(packet.length,len+4);
            len += 8;
        }else if(packet.length>126){
            ret.writeUInt8(126,len++);
            ret.writeUInt16BE(packet.length,len);
            len += 2;
        }else{
            ret.writeUInt8(packet.length,len++);
        }
        packet.copy(ret,len);
        return ret;
    },
};
exports.ProtocolHander = ProtocolHander;
