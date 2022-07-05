const puppeteer = require('puppeteer');
const fs = require("fs")
const crypto = require("crypto")
const https = require("https")
const getExtenion = require("get-url-extension")

// Create variable for iterating through site pages
let startPage = 1;

//create variable to control while loop
let looping = true;

// Create function downloadFile that will be called from within the loop below
function downloadFile(url, filename){
    const file = fs.createWriteStream('images_noms/'+ filename); // Use file system module to create new file with the name of hash plus the right extension type
    // Return a new promise that resolves when the file has downloaded and saved to our file system (images folder)
    return new Promise((resolve, reject)=>{

       const timeoutForDownload = setTimeout(()=>{
            fs.unlink('images_noms/'+ filename,  ()=>console.log('File Unlinked', filename));
            console.log('Attempt to download file took longer than 30 seconds');
            reject(false);
        }, 30 * 1000)

        const request = https.get(url, response => {
            response.pipe(file);
            console.log('Download file response status code:', response.statusCode);

            // Save response data as file
            file.on("finish", ()=> {
                clearTimeout(timeoutForDownload);
                file.close();
                // End await period of promise
                resolve(true);
            })
        });

        request.on('error', function(err) {
            fs.unlink('images_noms/'+ filename, ()=>console.log('File Unlinked', filename));
            console.log('There was an error downloading a file:');
            console.error(err);
            clearTimeout(timeoutForDownload);
            reject(false);
        });

  
        
        

    })
}

function escapeQuotesInField(inputField) {
   return inputField.replace(/"/g, '""');
}


// Main Puppeteer fuction 
(async () => {
  const browser = await puppeteer.launch(); // Launch headless broswer
  const page = await browser.newPage(); // Open new tab

  // Loop to increment page query parameter 
  while(looping){
      // Open website at current page index
      await page.goto(`https://www.awwwards.com/websites/nominees/?page=${startPage}`);
      
      // Identify element that contains website name and returns an array of each listing
      const websites = await page.$$(".list-items > .js-collectable");
      // Loop over array and get nth listing element reference
      // Within each element reference, query specific divs and elements and save the data as variables (website, title, country, & imgURL)
      for (let i = 0; i<websites.length; i++){
        const website=websites[i];
        const title = await website.$eval("h3 > a", el => el.innerText);
        
        const dateString = await website.$eval(".row-2col > .box-right", el => el.innerText);
        const country = await website.$eval(".row-2col > .box-left", el => el.innerText.split("From ")[1]);
        // For the image url, the site included references to two sizes of images. Used string manipulation to pull the larger one.
        const imgURL =  await website.$eval(".box-photo > img", el => {
           const srcset = el.getAttribute("data-srcset");
           const splitSet = srcset.split(",");
           if(splitSet.length === 2){
            return splitSet[1].split(" 2x")[0].trim()
           }
        
        });

        // Create unique id as hash by using value of concatentation of title and date string
        // This is to have a key to link images back to their data
        const hash = crypto.createHash('md5').update(title + dateString).digest("hex");
        const extension = getExtenion(imgURL); // Use open source library to pull file extension from the image's url
        const filename = hash + extension;
        console.log(startPage, title, dateString);
        const fileDownloadResult = await downloadFile(imgURL, filename).catch(bool => bool);
        fs.appendFile("data_noms.csv", `${hash},"${escapeQuotesInField(title)}","${dateString}",${country},${imgURL},${fileDownloadResult ? filename : "ERROR_DOWNLOADING" }\n`, ()=> {})
      } 
      // Increment page
      startPage++;
  }
  
  await browser.close();
})();

