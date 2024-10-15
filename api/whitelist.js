import axios from 'axios';

const REPO_OWNER = 'NewWhitelistService'; // Tên người sở hữu repository
const REPO_NAME = 'NewWhitelistService.github.io'; // Tên repository
const FILE_PATH = 'whitelist.json'; // Đường dẫn đến file whitelist

const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`; // Sử dụng API để lấy nội dung file

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Lấy token từ biến môi trường

const getWhitelist = async () => {
    const response = await axios.get(GITHUB_API_URL, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
        },
    });
    return JSON.parse(Buffer.from(response.data.content, 'base64').toString());
};

const updateWhitelist = async (newWhitelist) => {
    const newContent = Buffer.from(JSON.stringify(newWhitelist, null, 2)).toString('base64');

    // Lưu file mới vào GitHub
    await axios.put(GITHUB_API_URL, {
        message: 'Update whitelist',
        content: newContent,
        sha: response.data.sha // Cần sử dụng SHA để cập nhật file
    }, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
        },
    });
};

// Tạo key ngẫu nhiên
const generateRandomKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
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
        const { product, ownerId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product]) {
                whitelist[product] = {
                    ownerId: ownerId,
                    keys: {}
                };
            }

            await updateWhitelist(whitelist);
            return res.status(200).json({ status: 'success', message: 'Product created' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'PUT') {
        const { product, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product] || whitelist[product].ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to create a key for this product' });
            }

            const newKey = generateRandomKey();
            whitelist[product].keys[newKey] = 'NOT_SET'; // Chưa có HWID
            await updateWhitelist(whitelist);

            return res.status(200).json({ status: 'success', message: 'Key created', key: newKey });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'DELETE') {
        const { product, key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product] || whitelist[product].ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to delete this key' });
            }

            if (whitelist[product] && whitelist[product].keys[key]) {
                delete whitelist[product].keys[key];
                await updateWhitelist(whitelist);
                return res.status(200).json({ status: 'success', message: 'Key removed from whitelist' });
            } else {
                return res.status(404).json({ status: 'error', message: 'Key not found' });
            }
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'PATCH') {
        const { key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            for (const product in whitelist) {
                if (whitelist[product].keys[key]) {
                    whitelist[product].keys[key] = userId;
                    await updateWhitelist(whitelist);
                    return res.status(200).json({ status: 'success', message: 'Key redeemed successfully' });
                }
            }

            return res.status(404).json({ status: 'error', message: 'Key not found' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to redeem key' });
        }
    }

    return res.status(405).json({ error: 'Only GET, POST, PUT, PATCH, and DELETE requests are allowed' });
}
