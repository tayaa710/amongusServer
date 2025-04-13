import https from "https";
import fs from "fs";
import path from "path";

export const fetchTownOfUsRMod = async () => {
  try {
    const outputDir = path.join(process.cwd(), "roleInformation");

    // Make sure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log("Fetching the Town Of Us R README.md file");
    
    // Download the README.md file from the repository
    const readmeUrl = "https://raw.githubusercontent.com/eDonnes124/Town-Of-Us-R/master/README.md";
    const outputFile = path.join(outputDir, "TownOfUsR_README.md");
    
    await downloadFile(readmeUrl, outputFile);
    
    console.log(`Successfully downloaded Town Of Us R README.md to ${outputFile}`);
    
    // Extract role information from the README.md file
    console.log("Extracting role information from Town Of Us R README.md");
    const readmeContent = fs.readFileSync(outputFile, 'utf8');
    
    // Create our roles object structure
    const roles = {
      crewmate: {},
      impostor: {},
      neutral: {}
    };
    
    // Extract roles by categories
    extractRoles(readmeContent, roles);
    
    // Save the structured data to a JSON file
    const jsonPath = path.join(outputDir, 'townOfUsRMod.json');
    fs.writeFileSync(jsonPath, JSON.stringify(roles, null, 2));
    console.log(`Town Of Us R roles data saved to ${jsonPath}`);
    
    // Clean up the README file after processing
    try {
      fs.unlinkSync(outputFile);
      console.log(`Deleted temporary README file: ${outputFile}`);
    } catch (cleanupError) {
      console.warn(`Warning: Could not delete temporary README file: ${cleanupError.message}`);
    }
    
    return roles;

  } catch (error) {
    console.error("Error in fetchTownOfUsRMod:", error.message);
    return null;
  }
};

// Helper function to download a file from URL
const downloadFile = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      // Check if the request was successful
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file, status code: ${response.statusCode}`));
        return;
      }
      
      // Log download progress
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          process.stdout.write(`Progress: ${progress}% (${downloadedBytes}/${totalBytes} bytes)\r`);
        } else {
          process.stdout.write(`Downloaded: ${downloadedBytes} bytes\r`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\nDownload complete!');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
};

/**
 * Clean up markdown formatting from a string
 * @param {string} text - The markdown text to clean
 * @returns {string} - Cleaned text
 */
function cleanMarkdown(text) {
  if (!text) return '';
  
  // Remove markdown headers (###, ##, etc.)
  let cleaned = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold/italic formatting
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');     // Italic
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');     // Bold
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');       // Italic
  
  // Remove backslashes used for line breaks in markdown
  cleaned = cleaned.replace(/\\$/gm, '');
  
  // Remove "Team: X" prefixes
  cleaned = cleaned.replace(/^Team: (Impostors|Crewmates|Neutral)$/gm, '');
  
  // Replace multiple newlines with a single newline
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Extract role information from the README.md content
 * @param {string} content - The content of the README.md file
 * @param {Object} roles - The roles object to populate
 */
function extractRoles(content, roles) {
  const lines = content.split('\n');
  
  // Town Of Us R uses a table format for roles
  // First find the table headers to identify role categories
  let tableHeaderIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes("**Impostor Roles**") && line.includes("**Crewmate Roles**") && line.includes("**Neutral Roles**")) {
      tableHeaderIndex = i;
      break;
    }
  }
  
  if (tableHeaderIndex === -1) {
    console.log("Couldn't find role table in Town Of Us R README");
    return;
  }
  
  // Process role links in the table
  // The table format is like:
  // | [RoleName](#rolename) | [RoleName](#rolename) | [RoleName](#rolename) | [Modifier](#modifier) |
  let currentLine = tableHeaderIndex + 2; // Skip the header separator line
  
  // Keep track of roles we need to find descriptions for
  const impostorRoles = [];
  const crewmateRoles = [];
  const neutralRoles = [];
  
  // Process table rows until we reach the end of the table
  while (currentLine < lines.length) {
    const line = lines[currentLine].trim();
    
    // If we've reached a horizontal line or a new section, we're done with the table
    if (line === '' || line.match(/^##/) || !line.includes('|')) {
      break;
    }
    
    // Parse the table row - each role is in square brackets followed by a link
    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
    
    // We expect 4 columns: Impostor, Crewmate, Neutral, Modifier (we ignore modifiers)
    if (cells.length >= 3) {
      // Extract role names from table cells
      for (let i = 0; i < Math.min(3, cells.length); i++) {
        const cell = cells[i];
        // Extract role name from markdown link format: [RoleName](#rolename)
        const roleMatch = cell.match(/\[(.*?)\]/);
        if (roleMatch && roleMatch[1]) {
          const roleName = roleMatch[1];
          // Add to the appropriate category
          if (i === 0) impostorRoles.push(roleName);
          else if (i === 1) crewmateRoles.push(roleName);
          else if (i === 2) neutralRoles.push(roleName);
        }
      }
    }
    
    currentLine++;
  }
  
  // Now find role descriptions in the document
  // Each role has a header like ### RoleName
  
  // Process each role we found
  const allRoles = [
    { roles: impostorRoles, category: 'impostor' },
    { roles: crewmateRoles, category: 'crewmate' },
    { roles: neutralRoles, category: 'neutral' }
  ];
  
  for (const { roles: roleList, category } of allRoles) {
    for (const roleName of roleList) {
      // Find the section for this role
      let roleHeaderIndex = -1;
      const roleHeaderPattern = new RegExp(`^## ${roleName}$`, 'i');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (roleHeaderPattern.test(line)) {
          roleHeaderIndex = i;
          break;
        }
      }
      
      if (roleHeaderIndex !== -1) {
        // Collect the description until the next header or the end of the section
        let description = '';
        let currentIndex = roleHeaderIndex + 1;
        
        // Include the team information
        const teamLine = currentIndex < lines.length ? lines[currentIndex].trim() : '';
        if (teamLine.includes('Team:')) {
          // Store team information for later inclusion in a cleaner format
          const teamMatch = teamLine.match(/Team: (Impostors|Crewmates|Neutral)/i);
          if (teamMatch) {
            description = `Team: ${teamMatch[1]}\n`;
          }
          currentIndex++;
        }
        
        while (currentIndex < lines.length) {
          const line = lines[currentIndex].trim();
          
          // Stop at the next header or a separator
          if (line.startsWith('##') || line === '---') {
            break;
          }
          
          // Add to description
          if (line) {
            if (description) {
              description += '\n' + line;
            } else {
              description = line;
            }
          }
          
          currentIndex++;
        }
        
        // Add the role description after cleaning it up
        if (description) {
          roles[category][roleName] = cleanMarkdown(description.trim());
        } else {
          // If no description found, at least add the role name
          roles[category][roleName] = roleName;
        }
      } else {
        // If role header not found, still add the role with the role name
        roles[category][roleName] = roleName;
      }
    }
  }
}

// Export this as a module
export default { fetchTownOfUsRMod }; 