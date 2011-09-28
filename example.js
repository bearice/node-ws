var http = require('http'),ws=require('./websocket'),url=require('url');
var server = http.createServer(function(req,resp){
    resp.writeHeader(404);
    resp.end();   
});

function echo(conn,host){
    conn.on("close",function(){
        console.info("closed");
    });
    conn.on("error",function(err){
        console.error(err);
    });
    conn.on("data",function(data){
        console.log('data:'+data);
        conn.write(data);
    });
}

server.on('upgrade',ws.WebSocket(function(conn){
    var uri = url.parse(conn.req.url,true);
    if(uri.pathname=="/echo"){
        echo(conn);
        return true;
    }

    conn.writeHeader("404 Not Found",[],function(){
        conn.socket.destroy();
    });
    return false;
}));

server.listen(8080);
console.log('Server running...');
