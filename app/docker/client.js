//app/docker/client.js
const Docker = require('dockerode');

// Inicializa el cliente. Dockerode detecta automáticamente el socket en Windows/Linux/Mac
const docker = new Docker();

module.exports = docker;
