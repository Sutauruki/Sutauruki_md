const mega = require("megajs");

const auth = {
    email: process.env.MEGA_EMAIL,   // use your real valid mega account email
    password: process.env.MEGA_PASSWORD,  // use your real valid mega account password
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

const megaUploader = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            if (!auth.email || !auth.password || !auth.userAgent) {
                throw new Error("Missing required authentication fields");
            }

            const storage = new mega.Storage(auth, () => {
                const file = storage.upload({
                    name: name,
                    allowUploadBuffering: true
                });
                
                data.pipe(file);
                
                storage.on('add', (uploadedFile) => {
                    uploadedFile.link((err, url) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        storage.close();
                        resolve(url);
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = megaUploader;