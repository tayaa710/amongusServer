const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { fetchVideos } = require("./utils/fetchVideos");
const { fetchAllTheRolesMod } = require("./utils/fetchAllTheRolesMod");
// Import fetchOtherRolesMod dynamically
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
let rolesDataCache = null;
let rolesDataTimestamp = 0;
let theOtherRolesDataCache = null;
let theOtherRolesTimestamp = 0;
let townOfUsRDataCache = null;
let townOfUsRTimestamp = 0;

// Cache expiry time (13 hours)
const CACHE_EXPIRY = 20*60*1000;

// Reset cache function for testing
const resetCache = () => {
  videoDataCache = null;
  videoDataTimestamp = 0;
  sheetDataCache = null;
  sheetDataTimestamp = 0;
  rolesDataCache = null;
  rolesDataTimestamp = 0;
  theOtherRolesDataCache = null;
  theOtherRolesTimestamp = 0;
  townOfUsRDataCache = null;
  townOfUsRTimestamp = 0;
  console.log("All caches have been reset");
}

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
  
  if (fs.existsSync("roleInformation/allTheRolesMod.json")) {
    rolesDataCache = JSON.parse(fs.readFileSync("roleInformation/allTheRolesMod.json", "utf8"));
    rolesDataTimestamp = Date.now();
  }

  if (fs.existsSync("roleInformation/theOtherRolesMod.json")) {
    theOtherRolesDataCache = JSON.parse(fs.readFileSync("roleInformation/theOtherRolesMod.json", "utf8"));
    theOtherRolesTimestamp = Date.now();
  }

  if (fs.existsSync("roleInformation/townOfUsRMod.json")) {
    townOfUsRDataCache = JSON.parse(fs.readFileSync("roleInformation/townOfUsRMod.json", "utf8"));
    townOfUsRTimestamp = Date.now();
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

// Preload roles data on server startup if cache is empty or expired
const preloadRolesData = async () => {
  try {
    if (!rolesDataCache || Date.now() - rolesDataTimestamp >= CACHE_EXPIRY) {
      console.log("Preloading roles data...");
      const rolesData = await fetchAllTheRolesMod();
      if (rolesData) {
        rolesDataCache = rolesData;
        rolesDataTimestamp = Date.now();
        console.log("Roles data preloaded successfully.");
      } else {
        console.error("Preload failed: fetched roles data is empty or invalid.");
      }
    } else {
      console.log("Using existing roles data cache.");
    }

    // Preload TheOtherRoles data
    if (!theOtherRolesDataCache || Date.now() - theOtherRolesTimestamp >= CACHE_EXPIRY) {
      console.log("Preloading TheOtherRoles data...");
      // Dynamically import the ESM module
      const fetchOtherRolesModule = await import('./utils/fetchTheOtherRolesMod.js');
      const theOtherRolesData = await fetchOtherRolesModule.fetchOtherRolesMod();
      
      if (theOtherRolesData) {
        theOtherRolesDataCache = theOtherRolesData;
        theOtherRolesTimestamp = Date.now();
        console.log("TheOtherRoles data preloaded successfully.");
      } else {
        console.error("Preload failed: fetched TheOtherRoles data is empty or invalid.");
      }
    } else {
      console.log("Using existing TheOtherRoles data cache.");
    }
    
    // Preload Town Of Us R data
    if (!townOfUsRDataCache || Date.now() - townOfUsRTimestamp >= CACHE_EXPIRY) {
      console.log("Preloading Town Of Us R data...");
      // Dynamically import the ESM module
      const fetchTownOfUsRModule = await import('./utils/fetchTownOfUsRMod.js');
      const townOfUsRData = await fetchTownOfUsRModule.fetchTownOfUsRMod();
      
      if (townOfUsRData) {
        townOfUsRDataCache = townOfUsRData;
        townOfUsRTimestamp = Date.now();
        console.log("Town Of Us R data preloaded successfully.");
      } else {
        console.error("Preload failed: fetched Town Of Us R data is empty or invalid.");
      }
    } else {
      console.log("Using existing Town Of Us R data cache.");
    }
  } catch (err) {
    console.error("Error preloading roles data:", err);
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

// Add endpoint to reset cache for testing
app.get("/api/reset-cache", (req, res) => {
  resetCache();
  // Optionally delete cache files too
  try {
    if (fs.existsSync("videoData.json")) {
      fs.unlinkSync("videoData.json");
    }
    if (fs.existsSync("sheetData.json")) {
      fs.unlinkSync("sheetData.json");
    }
    if (fs.existsSync("roleInformation/allTheRolesMod.json")) {
      fs.unlinkSync("roleInformation/allTheRolesMod.json");
    }
    if (fs.existsSync("roleInformation/theOtherRolesMod.json")) {
      fs.unlinkSync("roleInformation/theOtherRolesMod.json");
    }
    if (fs.existsSync("roleInformation/townOfUsRMod.json")) {
      fs.unlinkSync("roleInformation/townOfUsRMod.json");
    }
  } catch (error) {
    console.error("Error deleting cache files:", error);
  }
  
  res.json({ message: "Cache reset successfully" });
});

app.get("/api/roles", async (req,res) => {
  try {
    // Check if cache is valid
    const cachesValid = rolesDataCache && 
                        Date.now() - rolesDataTimestamp < CACHE_EXPIRY &&
                        theOtherRolesDataCache && 
                        Date.now() - theOtherRolesTimestamp < CACHE_EXPIRY &&
                        townOfUsRDataCache &&
                        Date.now() - townOfUsRTimestamp < CACHE_EXPIRY;
    
    if (cachesValid) {
      console.log("Serving roles from cache");
      
      // Combine all roles from all mods into a single structure
      const combinedRoles = {
        crewmate: {
          ...rolesDataCache.crewmate,
          ...theOtherRolesDataCache.crewmate,
          ...townOfUsRDataCache.crewmate
        },
        impostor: {
          ...rolesDataCache.impostor,
          ...theOtherRolesDataCache.impostor,
          ...townOfUsRDataCache.impostor
        },
        neutral: {
          ...rolesDataCache.neutral,
          ...theOtherRolesDataCache.neutral,
          ...townOfUsRDataCache.neutral
        }
      };
      
      return res.json(combinedRoles);
    }
    
    console.log("Fetching fresh roles data");
    const allTheRoles = await fetchAllTheRolesMod();
    
    // Dynamically import the ESM modules
    const fetchOtherRolesModule = await import('./utils/fetchTheOtherRolesMod.js');
    const theOtherRoles = await fetchOtherRolesModule.fetchOtherRolesMod();
    
    const fetchTownOfUsRModule = await import('./utils/fetchTownOfUsRMod.js');
    const townOfUsRRoles = await fetchTownOfUsRModule.fetchTownOfUsRMod();
    
    // Check if all data fetching was successful
    const allDataAvailable = allTheRoles && theOtherRoles && townOfUsRRoles;
    
    if (allDataAvailable) {
      // Update cache
      rolesDataCache = allTheRoles;
      rolesDataTimestamp = Date.now();
      theOtherRolesDataCache = theOtherRoles;
      theOtherRolesTimestamp = Date.now();
      townOfUsRDataCache = townOfUsRRoles;
      townOfUsRTimestamp = Date.now();
      
      // Combine all roles from all mods into a single structure
      const combinedRoles = {
        crewmate: {
          ...allTheRoles.crewmate,
          ...theOtherRoles.crewmate,
          ...townOfUsRRoles.crewmate
        },
        impostor: {
          ...allTheRoles.impostor,
          ...theOtherRoles.impostor,
          ...townOfUsRRoles.impostor
        },
        neutral: {
          ...allTheRoles.neutral,
          ...theOtherRoles.neutral,
          ...townOfUsRRoles.neutral
        }
      };
      
      res.json(combinedRoles);
    } else {
      // If we couldn't fetch all data, return what we have
      console.log("Some role data fetching failed, returning partial data");
      
      // Start with empty structure
      const partialRoles = {
        crewmate: {},
        impostor: {},
        neutral: {}
      };
      
      // Add data from whatever sources succeeded
      if (allTheRoles) {
        partialRoles.crewmate = {...partialRoles.crewmate, ...allTheRoles.crewmate};
        partialRoles.impostor = {...partialRoles.impostor, ...allTheRoles.impostor};
        partialRoles.neutral = {...partialRoles.neutral, ...allTheRoles.neutral};
      }
      
      if (theOtherRoles) {
        partialRoles.crewmate = {...partialRoles.crewmate, ...theOtherRoles.crewmate};
        partialRoles.impostor = {...partialRoles.impostor, ...theOtherRoles.impostor};
        partialRoles.neutral = {...partialRoles.neutral, ...theOtherRoles.neutral};
      }
      
      if (townOfUsRRoles) {
        partialRoles.crewmate = {...partialRoles.crewmate, ...townOfUsRRoles.crewmate};
        partialRoles.impostor = {...partialRoles.impostor, ...townOfUsRRoles.impostor};
        partialRoles.neutral = {...partialRoles.neutral, ...townOfUsRRoles.neutral};
      }
      
      res.json(partialRoles);
    }
  } catch (error) {
    console.error("Error fetching roles:", error);
    
    // Fallback to cached data if available
    const cacheAvailable = rolesDataCache || theOtherRolesDataCache || townOfUsRDataCache;
    
    if (cacheAvailable) {
      console.log("Falling back to cached roles data");
      
      // Start with empty structure
      const fallbackRoles = {
        crewmate: {},
        impostor: {},
        neutral: {}
      };
      
      // Add data from whatever caches are available
      if (rolesDataCache) {
        fallbackRoles.crewmate = {...fallbackRoles.crewmate, ...rolesDataCache.crewmate};
        fallbackRoles.impostor = {...fallbackRoles.impostor, ...rolesDataCache.impostor};
        fallbackRoles.neutral = {...fallbackRoles.neutral, ...rolesDataCache.neutral};
      }
      
      if (theOtherRolesDataCache) {
        fallbackRoles.crewmate = {...fallbackRoles.crewmate, ...theOtherRolesDataCache.crewmate};
        fallbackRoles.impostor = {...fallbackRoles.impostor, ...theOtherRolesDataCache.impostor};
        fallbackRoles.neutral = {...fallbackRoles.neutral, ...theOtherRolesDataCache.neutral};
      }
      
      if (townOfUsRDataCache) {
        fallbackRoles.crewmate = {...fallbackRoles.crewmate, ...townOfUsRDataCache.crewmate};
        fallbackRoles.impostor = {...fallbackRoles.impostor, ...townOfUsRDataCache.impostor};
        fallbackRoles.neutral = {...fallbackRoles.neutral, ...townOfUsRDataCache.neutral};
      }
      
      return res.json(fallbackRoles);
    }
    
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

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
    await preloadRolesData();
    
    // Then start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
