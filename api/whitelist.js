import axios from 'axios';

const REPO_OWNER = 'NewWhitelistService'; // Tên người sở hữu repository
const REPO_NAME = 'NewWhitelistService.github.io'; // Tên repository
const FILE_PATH = 'whitelist.json'; // Đường dẫn đến file whitelist

const GITHUB_API_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;

const getWhitelist = async () => {
    const response = await axios.get(GITHUB_API_URL);
    return JSON.parse(response.data);
};

const updateWhitelist = async (newWhitelist) => {
    const newContent = Buffer.from(JSON.stringify(newWhitelist, null, 2)).toString('base64');

    // Lưu file mới vào GitHub
    await axios.put(GITHUB_API_URL, {
        message: 'Update whitelist',
        content: newContent
    });
};

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const whitelist = await getWhitelist();
            return res.status(200).json(whitelist);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to get whitelist' });
        }
    } else if (req.method === 'POST') {
        const { product, hwid, script_key } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product]) {
                whitelist[product] = {};
            }

            whitelist[product][hwid] = script_key; // Thêm key mới vào whitelist
            await updateWhitelist(whitelist);

            return res.status(200).json({ status: 'success', message: 'Key added to whitelist' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else {
        return res.status(405).json({ error: 'Only GET and POST requests are allowed' });
    }
}
