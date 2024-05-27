const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const cors = require('cors');
const mongo = require('./mongoose.init');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
mongo.connect();

app.use(require('cookie-parser')());
app.use(bodyParser.json({ limit: '2mb' }));

app.use(cors({
  origin: ["http://localhost:8081", "http://localhost:5080", "https://your-deployed-url.vercel.app"],
  methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
  credentials: true,
  sameSite: 'none'
}));

// Log requests for debugging
app.use((req, res, next) => {
  console.log(`Received request for ${req.url}`);
  next();
});

require('./app/routes')(app);

const __dirname1 = path.resolve();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname1, '/frontend/dist')));

  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname1, 'frontend', 'dist', 'index.html'))
  );
} else {
  app.get('/', (req, res) => {
    res.send('API is running..');
  });
}

app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.statusCode = 404;
  next(err);
});

const server = app.listen(process.env.PORT || 8080, () => {
  console.log('server started on PORT 5080');
});

const io = require('socket.io')(server, {
  pingTimeout: 60000,
  cors: {
    origin: ["http://localhost:8081", "http://localhost:5080", "https://your-deployed-url.vercel.app"]
  }
});

io.on('connection', (socket) => {
  console.log('connected to socket.io');

  socket.on('setup', (userData) => {
    socket.join(userData._id);
    socket.emit('connected');
  });

  socket.on('join chat', (room) => {
    socket.join(room);
  });

  socket.on('typing', (room) => socket.in(room).emit('typing'));
  socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

  socket.on('new message', (newMessageRecieved) => {
    let chat = newMessageRecieved.chat;
    if (!chat.users) return console.log('chat users not defined');

    chat.users.forEach(user => {
      if (user._id === newMessageRecieved.sender._id) return;
      socket.in(user._id).emit('message received', newMessageRecieved);
    });
  });
});
