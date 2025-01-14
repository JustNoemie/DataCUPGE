const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Send a request to sheet api to get all of the data
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function getData(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '157tezCYwqEVU79vsFQyc9zi1yqymA1jSFSStA1rb1-M',
    range: 'Feuille 1!1:15',
  });
  const rows = res.data.values;
  
  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }
  return rows;
}
async function OrganiseData(data){
    var categories = data[0] //Get the name of every line
    var organisedData = {};
    data.forEach((line, LineIndex) => {
      if(LineIndex < 2){return} //Skip line for name and description `${schoolName}.${categories[CellIndex]}`
      const schoolName = line[0];
      var schoolData = {};
      line.forEach((cell, CellIndex) => {
        if([0,2,3,8,14,21,24].includes(CellIndex)) {return}
        schoolData[categories[CellIndex]] = cell;
        
        
      });
      organisedData[schoolName] = schoolData;
    });
    return organisedData
}

/**
 * 
 * @param {google.auth.OAuth2} auth Authenticated Google OAuth client
 */
async function createJSON(auth){
    const rows = await getData(auth);
    const OrganisedData = await (OrganiseData(rows));
    const jsonData = JSON.stringify(OrganisedData, null, 2);
    
    fs.writeFile('data.json', jsonData, (err) => {
      if (err) {
          console.error('Erreur lors de la sauvegarde du fichier JSON :', err);
      } else {
          console.log('Fichier JSON sauvegardé avec succès !');
      }
  });
}

authorize().then(createJSON).catch(console.error);