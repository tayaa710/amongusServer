const axios = require("axios");
const fs = require("fs");
const { fetchSingleSheet } = require("./fetchSheetData");

const formatDuration = (isoDuration) => {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);

  const parts = [];
  if (hours > 0) parts.push(hours);
  parts.push(minutes.toString().padStart(hours > 0 ? 2 : 1, '0'));
  parts.push(seconds.toString().padStart(2, '0'));

  return parts.join(':');
};

const playlistID = "PLhjLcvbbPVrVOY5w5Pl7KuSe5fGroQJJD";

const fetchVideos = async (apiKey) => {
  let nextPageToken = "";
  let videoData = [];

  const sheet = await fetchSingleSheet(1053703173,0)
  

  try {
    do {
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/playlistItems",
        {
          params: {
            part: "snippet",
            maxResults: 50, 
            playlistId: playlistID,
            key: apiKey,
            pageToken: nextPageToken,
          },
        }
      );

      const videoIds = response.data.items.map(item => item.snippet.resourceId.videoId).join(',');

      const detailsResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "snippet,contentDetails,statistics",
            id: videoIds,
            key: apiKey,
          },
        }
      );

      const durations = {};
      const statisticsMap = {};
      const publishedAtMap = {};
      for (const item of detailsResponse.data.items) {
        durations[item.id] = formatDuration(item.contentDetails.duration);
        statisticsMap[item.id] = {
          viewCount: item.statistics.viewCount,
          likeCount: item.statistics.likeCount
        };
        publishedAtMap[item.id] = item.snippet.publishedAt;
      }

      for (const item of response.data.items) {
        const videoId = item.snippet.resourceId.videoId;
        videoData.push({
          id: videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium.url,
          duration: durations[videoId],
          viewCount: statisticsMap[videoId].viewCount,
          likeCount: statisticsMap[videoId].likeCount,
          publishedAt: publishedAtMap[videoId],
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Associate sheet data with each video by matching video id in the sheet's videolink
    const sheetEntries = Array.isArray(sheet) ? sheet : (sheet.data || []);
    videoData = videoData.map(video => {
      const matchingSheetEntries = sheetEntries.filter(entry => entry.videolink.includes(video.id));
      // console.log(matchingSheetEntries)
      let players = [];
      let roles = [];
      let mapNames = [];
      matchingSheetEntries.forEach(game => {
        
        if (game["mapname"]) {
          mapNames.push(game["mapname"]);
        }
        
        const rolesStr = game["players,rolesandtasks"];
        if (rolesStr) {
          rolesStr.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              const parts = trimmed.split(" - ");
              if (parts.length >= 2) {
                players.push(parts[0].trim());
                roles.push(parts[1].trim());
              }
            }
          });
        }
      });
      players = [...new Set(players)]; // remove duplicates
      roles = [...new Set(roles)]; // remove duplicates
      mapNames = [...new Set(mapNames)]; // remove duplicates
      console.log(mapNames)
      
      return { ...video, players, roles, mapNames };
    });

    fs.writeFileSync(
      'videoData1.txt',
      videoData.map(video =>
        `${video.title}\n${video.videoUrl}\nViews: ${video.viewCount} | Likes: ${video.likeCount} | Duration: ${video.duration} | Published: ${video.publishedAt}\n`
      ).join('\n---\n'),
      'utf-8'
    );
    console.log('Video data saved to videoData.txt');
    return videoData;
  } catch (error) {
    console.error("Error fetching videos:", error);
  }
};

module.exports = { fetchVideos };
