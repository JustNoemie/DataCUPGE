const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const jsonType = require('./type.json');

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
    spreadsheetId: '157tezCYwqEVU79vsFQyc9zi1yqymA1jSFSStA1rb1-M', //Unique id of the spreadsheet
    range: "Données écoles d'ingénieurs!1:100", //Range of data asked to sheet api
  });
  const rows = res.data.values; //get the result of the request
  
  if (!rows || rows.length === 0) { //DEPRECATED (will cause error)
    console.log('No data found.'); 
    return;
  }

  return rows; //Return raw data
}

function handleList(data){
  if(data.includes('"')){
    var finalList = [];
    var current = "";
    var isActive = false;
    console.log(data);
    //console.log(data.length);
    var i = 0;
    for (let char of data){
      if (char == '"'){
        isActive = !isActive;
      }else if (char == ',' && !isActive){
        finalList.push(current);
        current = "";
      }else {
        if (current != "" || char != " "){
          current += char
        }
      }
      //console.log(i);
      if((data.length - 1) == i){
        finalList.push(current);
      }
      i += 1;
    }
    return finalList
  }else {
    return data.split(", ")
  }
}

/**
 * Figures out the correct type for the current cell from a custom json (case-sensitive,
 * spelling-sensitive) and return the cell content in that type 
 * If the type in the file is incorrect it will not create an error
 * @param {*} index 
 * @param {*} data 
 * @returns 
 */
function handleType(index, data, typ){
  const type = jsonType["type"];
  switch(typ[index]){
    case "text":
      return data;
    case "number":
      return parseInt(data);
    case "boolean":
      return (data === "TRUE")
    case "list":
      return handleList(data);

  }
  
}


/**
 * Create an object that store every schools properties
 * @param {object} data 
 * @returns 
 */
function OrganiseData(data){
    var categories = data[1] //Get the name of every line
    const typ = data[2];
    var organisedData = [];
    data.forEach((line, LineIndex) => {
      if(LineIndex < 4){return} //Skip line for name and description
      const schoolName = line[0]; //Get the name of the school in the current line
      var schoolData = {};
      line.forEach((cell, CellIndex) => {
        if([5,6,14,20,26,30].includes(CellIndex)) {return} //Exclude title columns
        if(CellIndex == 0){
          schoolData['slug'] = cell.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-");
          cell.normalize("NFD").replace()
          schoolData['name'] = cell;
        }
        //if(CellIndex == 8){ console.log(cell)};
        schoolData[categories[CellIndex]] = handleType(CellIndex, cell, typ); //Store the property with the appropriate type

      });
      organisedData.push(schoolData) //Store the school and its properties
    });
    return organisedData
}

/**
 * Create a json (don't check if there is already one) name "data.json" in the current folder
 * @param {google.auth.OAuth2} auth Authenticated Google OAuth client
 */
async function createJSON(auth){
    const rows = await getData(auth); 
    
    const OrganisedData = (OrganiseData(rows)); 
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