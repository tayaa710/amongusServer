import simpleGit from "simple-git";
import fs from "fs";
import path from "path";
import { rimraf } from "rimraf";
import https from "https";

export const fetchOtherRolesMod = async () => {
  try {
    const outputDir = path.join(process.cwd(), "roleInformation");

    // Make sure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log("Fetching the README.md file");
    
    // Instead of cloning the entire repo, just download the README.md file
    const readmeUrl = "https://raw.githubusercontent.com/TheOtherRolesAU/TheOtherRoles/main/README.md";
    const outputFile = path.join(outputDir, "README.md");
    
    await downloadFile(readmeUrl, outputFile);
    
    console.log(`Successfully downloaded README.md to ${outputFile}`);
    
    // Extract role information from the README.md file
    console.log("Extracting role information from README.md");
    const readmeContent = fs.readFileSync(outputFile, 'utf8');
    
    // Create our roles object structure
    const roles = {
      crewmate: {},
      impostor: {},
      neutral: {},
      modifier: {}
    };
    
    // Extract roles by categories
    extractRoles(readmeContent, roles);
    
    // Save the structured data to a JSON file
    const jsonPath = path.join(outputDir, 'theOtherRolesMod.json');
    fs.writeFileSync(jsonPath, JSON.stringify(roles, null, 2));
    console.log(`Roles data saved to ${jsonPath}`);
    
    // Clean up the README file after processing
    try {
      fs.unlinkSync(outputFile);
      console.log(`Deleted temporary README file: ${outputFile}`);
    } catch (cleanupError) {
      console.warn(`Warning: Could not delete temporary README file: ${cleanupError.message}`);
    }
    
    return roles;

  } catch (error) {
    console.error("Error in fetchOtherRolesMod:", error.message);
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
  cleaned = cleaned.replace(/^Team: (Impostors|Impostor|Crewmates|Crewmate|Neutral|Neutral Killer).*$/gm, '');
  
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
  
  let currentCategory = '';
  let currentRole = '';
  let description = '';
  let inRoleSection = false;
  let inDescription = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for main role category headers
    if (line.match(/^## (Crewmate|Impostor|Neutral|Modifier) Roles$/i)) {
      inRoleSection = true;
      continue;
    }
    
    // Detect individual role headers (they start with ## followed by role name)
    if (line.match(/^## [A-Za-z\s\-]+$/) && !line.includes('Roles') && !line.includes('Settings') && !line.includes('Game Options')) {
      // If we were processing a role, save it before moving to the next
      if (currentRole && description && currentCategory) {
        roles[currentCategory][currentRole] = cleanMarkdown(description.trim());
      }
      
      // Start new role
      currentRole = line.substring(3).trim();
      description = '';
      inDescription = true;
      
      // Determine the role's category by looking at the next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.includes('Team: Impostors') || nextLine.includes('Team: Impostor')) {
          currentCategory = 'impostor';
        } else if (nextLine.includes('Team: Crewmates') || nextLine.includes('Team: Crewmate')) {
          currentCategory = 'crewmate';
        } else if (nextLine.includes('Team: Neutral') || nextLine.includes('Team: Neutral Killer')) {
          currentCategory = 'neutral';
        } else if (line.toLowerCase().includes('modifier')) {
          currentCategory = 'modifier';
        }
      }
      
      continue;
    }
    
    // Stop collecting when we hit Game Options or a separator line
    if (line.includes('### Game Options') || line.match(/^-{3,}$/)) {
      inDescription = false;
    }
    
    // If we're in description mode and have content, add it
    if (inDescription && line && currentRole && currentCategory) {
      if (description) {
        description += '\n' + line;
      } else {
        description = line;
      }
    }
  }
  
  // Add the last role if there was one being processed
  if (currentRole && description && currentCategory) {
    roles[currentCategory][currentRole] = cleanMarkdown(description.trim());
  }
}

// Export this as a module instead of running it directly
export default { fetchOtherRolesMod };
