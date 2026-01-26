//filesystem/composeWriter.js
const fs = require('fs').promises;
const path = require('path');

/**
 * Saves the Docker Compose YAML content to a file in the project root.
 * @param {string} yamlContent - The YAML string to save.
 * @returns {Promise<string>} - The absolute path of the saved file.
 */
async function saveComposeFile(yamlContent) {
    // Use process.cwd() to target the project root where the app is running from.
    const filePath = path.join(process.cwd(), 'docker-compose.generated.yml');

    await fs.writeFile(filePath, yamlContent, 'utf8');
    return filePath;
}

module.exports = { saveComposeFile };
