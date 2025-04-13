import simpleGit from "simple-git";
import fs from "fs";
import path from "path";
import { rimraf } from "rimraf";

export const fetchAllTheRolesMod = async () => {
  try {
    // Setup directories
    const tempDir = path.join(process.cwd(), "temp_clone");
    const outputDir = path.join(process.cwd(), "roleInformation");
    
    // Make sure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
      rimraf.sync(tempDir);
    }
    
    // Clone the wiki repository
    console.log("Cloning wiki repository...");
    const git = simpleGit();
    await git.clone("https://github.com/Zeo666/AllTheRoles.wiki.git", tempDir);
    
    // Get only role files (they start with "Roles")
    const files = fs.readdirSync(tempDir);
    const roleFiles = files.filter(file => 
      file.endsWith('.md') && file.startsWith('Roles')
    );
    
    console.log(`Found ${roleFiles.length} role files`);
    
    // Create our roles object structure
    const roles = {
      crewmate: {},
      impostor: {},
      neutral: {}
    };
    
    // Process each role file
    for (const file of roleFiles) {
      // Determine role type from filename
      let roleType = '';
      if (file.includes('Crewmate')) roleType = 'crewmate';
      else if (file.includes('Impostor')) roleType = 'impostor';
      else if (file.includes('Neutral')) roleType = 'neutral';
      
      // Read the file content
      const filePath = path.join(tempDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract role names and descriptions
      const rolesData = extractRoles(content);
      roles[roleType] = rolesData;
    }
    
    // Save the simplified JSON file
    const jsonPath = path.join(outputDir, 'allTheRolesMod.json');
    fs.writeFileSync(jsonPath, JSON.stringify(roles, null, 2));
    console.log(`Roles data saved to ${jsonPath}`);
    
    // Clean up any existing role markdown files in the output directory
    roleFiles.forEach(file => {
      const filePath = path.join(outputDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted ${file}`);
      }
    });
    
    // Clean up temp directory
    rimraf.sync(tempDir);
    console.log("Temporary files cleaned up");
    
    return roles;
  } catch (error) {
    console.error("Error fetching roles:", error);
    return null;
  }
}

/**
 * Extract role names and descriptions from markdown content
 * @param {string} markdown - The markdown content to parse
 * @returns {Object} - Object with role names as keys and descriptions as values
 */
function extractRoles(markdown) {
  const roles = {};
  const lines = markdown.split('\n');
  
  let currentRole = null;
  let description = '';
  let inDescription = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Role headers start with "## "
    if (line.startsWith('## ')) {
      // If we were processing a role, save it before moving to next
      if (currentRole && description) {
        roles[currentRole] = description.trim();
      }
      
      // Start a new role
      currentRole = line.substring(3).trim();
      description = '';
      inDescription = true;
      continue;
    }
    
    // Stop collecting when we hit Game Options or a separator line
    if (line.includes('**Game Options**') || line.startsWith('-------')) {
      inDescription = false;
    }
    
    // If we're in description mode and have content, add it
    if (inDescription && line && currentRole) {
      if (description) {
        description += '\n' + line;
      } else {
        description = line;
      }
    }
  }
  
  // Add the last role if there was one being processed
  if (currentRole && description) {
    roles[currentRole] = description.trim();
  }
  
  return roles;
}

