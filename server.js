const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongo = require("./mongoose.init");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Connect to MongoDB
mongo.connect();

// CORS configuration
const allowedOrigins = [
  "https://chatify-front-beta.vercel.app",
  "http://localhost:8081",
  "http://localhost:5080",
  "https://webchatapplication-chatify.fly.dev",
  "http://localhost:8080",
  "https://chatify-test-abhid1239s-projects.vercel.app",
  "https://chatify-test.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  sameSite: 'none'
}));

app.use(require("cookie-parser")());
app.use(bodyParser.json({ limit: "2mb" }));

// Load routes
require("./app/routes")(app);

// Production environment configuration
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "frontend", "dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// Handle 404 errors
app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.statusCode = 404;
  next(err);
});

// Start the server
const server = app.listen(process.env.PORT || 8080, () => {
  console.log("server started on PORT ", process.env.PORT || 8080);
});

// Socket.io setup with CORS
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: allowedOrigins,
  },
});

// Socket.io connections
io.on("connection", (socket) => {
  console.log("connected to socket.io");

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));

  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageReceived) => {
    let chat = newMessageReceived.chat;
    if (!chat.users) return console.log("chat users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageReceived.sender._id) return;
      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });
});

module.exports = app;
