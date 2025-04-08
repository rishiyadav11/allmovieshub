require("dotenv").config();
const axios=require('axios');
const puppeteer=require("puppeteer");
const mongoose=require("mongoose");
const { Posts, Pages }=require("./models/BotPosts.js");
const path=require('path');
const fs=require("fs");
const SITE="https://allmovieshub.chat/";
// const CATEGORY="dual-audio-movies";
const IS_FIRST=false;

const main=async () => {
    let browser;
    try {
        browser=await puppeteer.launch({
            headless: true,
            // executablePath: '/snap/bin/chromium', // Use the correct Chromium path here
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-notifications',
                '--disable-popup-blocking'
            ]
        });
        const page=await browser.newPage();

        // Find the existing page document


        // Scrape the page for posts
        const scrapePage=async () => {
            const postList=await page.evaluate(() => {
                let posts=Array.from(document.querySelectorAll('.post'));
                return posts.map(post => {
                    let postUrl=post.querySelector('a').href;
                    let title=post.querySelector('a').title;
                    let poster=post.querySelector('img').src;
                    return { postUrl, title, poster };
                });
            });

            // Loop through the postList to scrape individual posts
            for (let post of postList) {
                const totalPosts=await Posts.countDocuments();
                console.log(`Scraping post: ${totalPosts+1} :) \n`);

                try {
                    await page.goto(post.postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                    let postDetails=await page.evaluate((post) => {
                        const {
                            title,
                            poster,
                        }=post;
                        const unwantedWords=["|", "480p", "720p", "1080p", "hindi", "english", "download", "complete", "&"];
                        const spans=Array.from(document.querySelectorAll('span'));
                        const strongs=Array.from(document.querySelectorAll('strong'));
                        const images=Array.from(document.querySelectorAll('.size-full'));

                        const featuredImage=images[0]?.src||poster;
                        const imdbRating=strongs.find((elem) => elem.innerText.trim()==="IMDb Rating")?.parentElement.parentElement.innerText.replace("IMDb Rating", "").trim().replace(/^:\s*/, "")||"N/A";
                        const releaseYear=strongs.find((elem) => elem.innerText.trim()==="Release Year")?.parentElement.parentElement.innerText.replace("Release Year", "").trim().replace(/^:\s*/, "")||"N/A";
                        const genres=strongs.find((elem) => elem.innerText.trim()==="Genre")?.parentElement.parentElement.innerText.replace("Genre", "").trim().replace(/^:\s*/, "")||"N/A";
                        const format=strongs.find((elem) => elem.innerText.trim()==="Format")?.parentElement.parentElement.innerText.replace("Format", "").trim().replace(/^:\s*/, "")||"N/A";
                        const language=strongs.find((elem) => elem.innerText.trim()==="Language")?.parentElement.parentElement.innerText.replace("Language", "").trim().replace(/^:\s*/, "")||"N/A";
                        const starCast=strongs.find((elem) => elem.innerText.trim()==="Star Cast")?.parentElement.parentElement.innerText.replace("Star Cast", "").trim().replace(/^:\s*/, "")||"N/A";
                        const director=strongs.find((elem) => elem.innerText.trim()==="Director")?.parentElement.parentElement.innerText.replace("Director", "").trim().replace(/^:\s*/, "")||"N/A";
                        const fileSize=strongs.find((elem) => elem.innerText.trim()==="File Size")?.parentElement.innerText.replace("File Size", "").trim().replace(/^:\s*/, "")||"N/A";
                        const quality=strongs.find((elem) => elem.innerText.trim()==="Quality")?.parentElement.parentElement.innerText.replace("Quality", "").trim().replace(/^:\s*/, "")||"N/A";
                        let image=images[1]?.src;
                        if (!image) {
                            image=images[0]?.src;
                        }
                        const slug=location.pathname.split('/').filter(Boolean).pop();
                        const words=title.toLowerCase().split(" ");
                        const keywords=words.filter(word => !unwantedWords.includes(word));
                        const metaDesc=`${title} in HD quality for free.`;
                        const synopsis=strongs.find((e) => e.innerText.includes("Movie-SYNOPSIS/Story"))?.parentElement.nextElementSibling.innerText||"No synopsis available";
                        const ems=Array.from(document.querySelectorAll('em'));
                        const downloadLinks=ems.slice(1).map(em => {
                            return { type: em?.parentElement.innerText, link: em?.parentElement.href };
                        });

                        return {
                            poster,
                            title,
                            featuredImage,
                            imdbRating,
                            releaseYear,
                            genres,
                            format,
                            language,
                            starCast,
                            director,
                            fileSize,
                            quality,
                            image,
                            slug,
                            keywords,
                            metaDesc,
                            synopsis,
                            downloadLinks,
                        };
                    }, post);

                    // Function to download image
                    const downloadImage=async (url, savePath) => {
                        const response=await axios({
                            url,
                            method: 'GET',
                            responseType: 'stream',
                        });

                        return new Promise((resolve, reject) => {
                            const stream=response.data.pipe(fs.createWriteStream(savePath));
                            stream.on('finish', resolve);
                            stream.on('error', reject);
                        });
                    };

                    // Ensure the directory exists
                    const dirPoster=path.join(__dirname, 'public', 'movies', 'poster');
                    if (!fs.existsSync(dirPoster)) {
                        fs.mkdirSync(dirPoster, { recursive: true });
                    }

                    // Ensure the directory exists
                    const dirImage=path.join(__dirname, 'public', 'movies', 'image');
                    if (!fs.existsSync(dirImage)) {
                        fs.mkdirSync(dirImage, { recursive: true });
                    }



                    const savePathPoster=path.join(dirPoster, `${postDetails.slug}.jpg`);
                    const savePathImage=path.join(dirImage, `${postDetails.slug}.jpg`);

                    const existingPost=await Posts.findOne({ title: postDetails.title });
                    if (existingPost) {

                        console.log(`Post already exists: ${post.title} \n`);

                        // await Posts.findOneAndUpdate(
                        //     { title: postDetails.title }, // Find the post by title
                        //     {
                        //         $set: postDetails, // Update other fields in postDetails
                        //         $addToSet: { categories: CATEGORY } // Add only if not already present
                        //     },
                        //     { upsert: true, new: true } // Create a new document if none is found and return the updated document
                        // );

                        // // update all the fields
                        // await Posts.findOneAndUpdate({ title: postDetails.title }, postDetails, { upsert: true, new: true });

                        // console.log(`Post updated. \n`);
                        // const updatedPost=await Posts.findOne({ title: postDetails.title });
                        // console.log(updatedPost.categories, "\n");

                    } else {

                        // save the post
                        downloadImage(postDetails.poster, savePathPoster)
                            .then(async () => {

                                downloadImage(postDetails.image, savePathImage)
                                    .then(async () => {
                                        console.log('Image downloaded and saved with the correct extension');
                                        await Posts.create(postDetails);  // Save the new post to the database
                                        console.log(`Post saved: ${post.title} \n`);
                                        // await Posts.findOneAndUpdate(
                                        //     { title: postDetails.title }, // Find the post by title
                                        //     {
                                        //         $set: postDetails, // Update other fields in postDetails
                                        //         $addToSet: { categories: CATEGORY } // Add only if not already present
                                        //     },
                                        //     { upsert: true, new: true } // Create a new document if none is found and return the updated document
                                        // );
                                        // // update all the fields
                                        // await Posts.findOneAndUpdate({ title: postDetails.title }, postDetails, { upsert: true, new: true });

                                        // console.log(`Post updated. \n`);
                                        // const updatedPost=await Posts.findOne({ title: postDetails.title });
                                        // console.log(updatedPost.categories, "\n");

                                    })
                                    .catch(async (error) => {
                                        if (error.code==='ENOTFOUND'||error.message.includes('ENOTFOUND')) {
                                            console.warn('Image URL seems malformed or missing domain, fixing...');

                                            // Fix the image URL
                                            let cleanPath=postDetails.image;

                                            // If it starts with "//", remove it first
                                            if (cleanPath.startsWith('//')) {
                                                cleanPath=cleanPath.substring(2);
                                            }

                                            // If it starts with "http", strip it too
                                            cleanPath=cleanPath.replace(/^https?:\/\//, '');

                                            // Remove any malformed domain from the start
                                            cleanPath=cleanPath.replace(/^allmovieshub.*?\//, ''); // removes anything like "allmovieshub.chathttp/" etc.

                                            // Now re-append the correct domain
                                            postDetails.image=`https://allmovieshub.chat/${cleanPath}`;

                                            try {
                                                await downloadImage(postDetails.image, savePathImage);
                                                console.log('Image downloaded after fixing the domain');
                                                await Posts.create(postDetails);
                                                console.log(`Post saved: ${post.title} \n`);

                                                // await Posts.findOneAndUpdate(
                                                //     { title: postDetails.title },
                                                //     { $set: postDetails, $addToSet: { categories: CATEGORY } },
                                                //     { upsert: true, new: true }
                                                // );
                                                // await Posts.findOneAndUpdate({ title: postDetails.title }, postDetails, { upsert: true, new: true });

                                                // console.log(`Post updated. \n`);
                                                // const updatedPost=await Posts.findOne({ title: postDetails.title });
                                                // console.log(updatedPost.categories, "\n");
                                            } catch (retryError) {
                                                console.error('Retry failed: could not download the image after fixing domain.', retryError);
                                            }
                                        } else {
                                            console.error('Failed to download the image:', error);
                                        }
                                    });



                            })
                            .catch((error) => {
                                console.error('Failed to download the poster:', error);
                            });

                    }

                } catch (error) {
                    console.error(`Error scraping post: ${post.title} \n`, error);
                }
            }
            try {
                // Find the existing page document
                const pageInfo=await Pages.findOne({});

                if (pageInfo&&pageInfo.pageUrl) {
                    console.log(`Resuming from last scraped page: ${pageInfo.pageUrl}`);
                    await page.goto(pageInfo.pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                } else {
                    console.log("No previous page found, starting from homepage -->", SITE);
                    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
                }

                // Wait for `.nextpostslink` to be present, but don't throw error if not found
                // Wait for `.nextpostslink`, but silently fail if not found
                await page.waitForSelector('.nextpostslink', { timeout: 10000 }).catch(() => {
                    console.log("No '.nextpostslink' found in DOM.");
                });

                if (IS_FIRST) {
                    await scrapePage();
                }

                const nextHref=await page.evaluate(() => {
                    const nextLink=document.querySelector('.nextpostslink');
                    return nextLink? nextLink.href:null;
                });

                console.log("Extracted nextHref:", nextHref); // <---- HERE'S THE RAW VALUE

                if (nextHref) {
                    console.log(`Going to next page: ${nextHref}`);
                    await page.goto(nextHref, { waitUntil: 'domcontentloaded', timeout: 60000 });

                    await Pages.findOneAndUpdate({}, { pageUrl: nextHref }, { upsert: true });
                    console.log(`Page URL updated: ${nextHref}`);
                } else {
                    console.log("No next page found. Possibly end of pagination or broken link.");
                }




            } catch (error) {
                console.error("Error going to the next page:", error);
            }

            // Recursive call to continue scraping the next pageee
            await scrapePage();


        };
        // Start scraping the page
        await scrapePage();


    } catch (error) {
        console.error(error);
    } finally {
        await browser.close();
    }
};

// Start the server
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to the database.");
    console.log("Starting the scraping process... \n");
    main();
}).catch((err) => {
    console.log("Error connecting to the database...");
    console.log(err);
});  