var st = require('node-static'),
    crypto = require('crypto'),
    fs = require('fs'),
    http = require('http'),
    file = new(st.Server)();

var port = process.env.VMC_APP_PORT || process.env.PORT || 8060;

var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(port);

    var io = require('socket.io').listen(app),
    //game object
    MZ = {};

var generateGameHash = function(){
    var seed = crypto.randomBytes(20),
        //we leave the first 6 chars of the hash 
        hash = crypto.createHash('sha1').update(seed).digest('hex').substr(0, 6);
     
    //still check for uniqueness
    if (MZ.GAMES[hash]){
        return generateGameHash();
    }

    return hash;
};

var Player = function(id){
    this.id = id;
    this.x = null;
    this.game = null;
    this.ball = { 
      position: [0, 0, 0],
      vel: {
        x: 0,
        y: 0
      }
    };
    
    var me = this;

    var setX = function(x, y){
        me.x = x;
    };

    var getX = function(){
        return me.x;
    };

    var getId = function(){
        return me.id;
    };

    var joinGame = function(gameHash){
        this.game = gameHash;
    };

    var getGame = function(){
        return this.game;
    };

    var setGame = function(hash){
        this.game = hash;
    };
    
    var setBall = function(ball) {
      this.ball = ball;
    };
    
    var getBall = function() {
      return this.ball;
    }

    return {
        setX : setX,
        getX : getX,
        getId : getId,
        joinGame : joinGame,
        getGame : getGame,
        setGame : setGame,
        setBall : setBall,
        getBall: getBall
    };
};

var removeGamePlayer = function(gameId, player){
    var game = MZ.GAMES[gameId],
        idx = null;

    if (game){
        for (var i=0, l=game.length; i<l; i+=1){
            if (game[i] === player){
                idx = i;
                break;
            }
        }

        if (idx != null){
            game.splice(idx, 1);
        }
    }
};

//all game players
MZ.PLAYERS = {};

/*object with all games running (pvp) - games also act as rooms for broadcasting messages
 so that we can easily select players playing together. The structure is :
 {
    'gameHash' : [ player1, player2 ]
 }
*/
MZ.GAMES = {};

//object with all sockets currently connected
MZ.SOCKETS = {};

io.sockets.on('connection', function (socket) {
    var token  = socket.id,
        player = new Player(token);

    MZ.SOCKETS[token] = socket;
    MZ.PLAYERS[token] = player;

    //events with front/back prefix for easier development
    socket.emit('back-connected', { socketToken: token });

    socket.on('front-newgame', function(data) {
        var hash = data.data,
            player = MZ.PLAYERS[socket.id],

            //is it the second player in game ?
            secondPlayer = false,
            game;

        if (!player.getGame()){
            if (!hash){
                hash = generateGameHash(); 
            }

            game = MZ.GAMES[hash];

            if (game != null && game.length !== 2){
                MZ.GAMES[hash].push(player);

                secondPlayer = true;
            } else {
                if (game != null && game.length === 2){
                    //2 players already
                    hash = generateGameHash();
                }
                MZ.GAMES[hash] = [player];
            }

            player.setGame(hash);

            //join to new room
            //https://github.com/LearnBoost/socket.io/wiki/Rooms
            socket.join(hash);
        } else {
            hash = player.getGame();
            secondPlayer = true;
        }

        //debug
        var rooms = io.sockets.manager.roomClients[socket.id];

        io.sockets.in(hash).emit('back-newgame', {hash: hash, secondPlayer: secondPlayer, rooms: rooms, games: MZ.GAMES, totalRooms: io.sockets.manager.rooms});    
    });

    //TODO save position change
    socket.on('front-playermove', function(data){
        var player = MZ.PLAYERS[socket.id],
            gameHash = player.getGame(),
            posX = data.x,
            ball = data.ball;

//        if (posX !== null) {
          player.setX(posX);
        // } else {
        //     posX = player.getX;
        //   }
        //         
        if (ball !== undefined) {
          player.setBall(ball);
        }
        
        console.log(posX, ball);
        socket.broadcast.to(gameHash).emit('back-playermove', {x: posX, ball: ball});
    });

    socket.on('disconnect', function () {
        var player = MZ.PLAYERS[socket.id],
            gameHash = player.getGame(),
            game   = MZ.GAMES[gameHash];

        removeGamePlayer(game, player);

        //second player still in the game
        if (game && game.length > 0){
            //socket.broadcast.to(gameHash).emit('back-playerleft');
            socket.broadcast.to(gameHash).emit('back-playerleft', {gameHash: gameHash});
        } else {
            delete MZ.GAMES[player.getGame()];
        }

        delete MZ.SOCKETS[socket.id];
        delete MZ.PLAYERS[socket.id];
    });
});