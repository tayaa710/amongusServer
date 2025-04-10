const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { fetchVideos } = require("./utils/fetchVideos");
const fs = require("fs");
const path = require("path");
const app = express();
require("dotenv").config();

const { fetchSheetData } = require("./utils/fetchSheetData");

// Cache variables
let videoDataCache = null;
let videoDataTimestamp = 0;
let sheetDataCache = null;
let sheetDataTimestamp = 0;

// Cache expiry time (1 hour)
const CACHE_EXPIRY = 60*60*1000;

// Try to load existing cache from disk
try {
  if (fs.existsSync("videoData.json")) {
    videoDataCache = JSON.parse(fs.readFileSync("videoData.json", "utf8"));
    videoDataTimestamp = Date.now();
  }
  
  if (fs.existsSync("sheetData.json")) {
    sheetDataCache = JSON.parse(fs.readFileSync("sheetData.json", "utf8"));
    sheetDataTimestamp = Date.now();
  }
} catch (error) {
  console.error("Error loading cache:", error);
}

// Preload video data on server startup if cache is empty or expired
const preloadVideoData = async () => {
  try {
    if (!videoDataCache || Date.now() - videoDataTimestamp >= CACHE_EXPIRY) {
      console.log("Preloading video data...");
      const apiKey = process.env.APIKEY;
      const videoData = await fetchVideos(apiKey);
      if (videoData && Array.isArray(videoData) && videoData.length > 0) {
        videoDataCache = videoData;
        videoDataTimestamp = Date.now();
        fs.writeFileSync("videoData.json", JSON.stringify(videoData, null, 2));
        console.log("Video data preloaded successfully.");
      } else {
        console.error("Preload failed: fetched video data is empty or invalid.");
      }
    } else {
      console.log("Using existing video data cache.");
    }
  } catch (err) {
    console.error("Error preloading video data:", err);
  }
};

// Preload sheet data on server startup if cache is empty or expired
const preloadSheetData = async () => {
  try {
    if (!sheetDataCache || Date.now() - sheetDataTimestamp >= CACHE_EXPIRY) {
      console.log("Preloading sheet data...");
      const data = await fetchSheetData();
      if (data && Array.isArray(data) && data.length > 0) {
        sheetDataCache = data;
        sheetDataTimestamp = Date.now();
        fs.writeFileSync("sheetData.json", JSON.stringify(data, null, 2));
        console.log("Sheet data preloaded successfully.");
      } else {
        console.error("Preload failed: fetched sheet data is empty or invalid.");
      }
    } else {
      console.log("Using existing sheet data cache.");
    }
  } catch (err) {
    console.error("Error preloading sheet data:", err);
  }
};

app.use(express.json());

morgan.token("body", (request) => {
  if (request.method === "POST") {
    return JSON.stringify(request.body);
  } else {
    return "";
  }
});

const errorHandler = (error, request, response, next) => {
  console.error(error.message);

  if (error.name === "CastError") {
    return response.status(400).send({ error: "malformatted id" });
  } else if (error.name === "ValidationError") {
    return response.status(400).json({ error: error.message });
  }

  next(error);
};

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms :body")
);
app.use(cors());

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: "unknown endpoint" });
};

app.get("/api/videos", async (request, response) => {
  try {
    // Check if cache is valid
    if (videoDataCache && Date.now() - videoDataTimestamp < CACHE_EXPIRY) {
      console.log("Serving videos from cache");
      return response.json(videoDataCache);
    }
    
    console.log("Fetching fresh video data");
    const apiKey = process.env.APIKEY;
    const videoData = await fetchVideos(apiKey);
    
    if (videoData) {
      // Update cache
      videoDataCache = videoData;
      videoDataTimestamp = Date.now();
      
      // Save to file for persistence
      fs.writeFileSync("videoData.json", JSON.stringify(videoData, null, 2));
      response.json(videoData);
    } else {
      response.status(500).json({ error: "Failed to fetch video data" });
    }
  } catch (error) {
    console.error("Error in video fetch:", error);
    
    // Fallback to cached data if available
    if (videoDataCache) {
      console.log("Falling back to cached data");
      return response.json(videoDataCache);
    }
    
    response.status(500).json({ error: "Failed to fetch video data" });
  }
});

app.get("/api/sheetData", async (req, res) => {
  try {
    // Check if cache is valid
    if (sheetDataCache && Date.now() - sheetDataTimestamp < CACHE_EXPIRY) {
      console.log("Serving sheet data from cache");
      return res.json(sheetDataCache);
    }
    
    console.log("Fetching fresh sheet data");
    const data = await fetchSheetData();
    
    if (data) {
      // Update cache
      sheetDataCache = data;
      sheetDataTimestamp = Date.now();
      
      // Save to file for persistence
      fs.writeFileSync("sheetData.json", JSON.stringify(data, null, 2));
      res.json(data);
    } else {
      res.status(500).json({ error: "Failed to fetch sheet data" });
    }
  } catch (err) {
    console.error("Error fetching sheet data:", err);
    
    // Fallback to cached data if available
    if (sheetDataCache) {
      console.log("Falling back to cached sheet data");
      return res.json(sheetDataCache);
    }
    
    res.status(500).json({ error: "Failed to fetch sheet data" });
  }
});

app.use(unknownEndpoint);
app.use(errorHandler);

/*Server Setup*/
const PORT = process.env.PORT;

// Start server only after preloading data
const startServer = async () => {
  try {
    // First preload the data
    await preloadVideoData();
    await preloadSheetData();
    
    // Then start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
