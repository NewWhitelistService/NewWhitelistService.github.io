// api/whitelist.js
export default function handler(req, res) {
  const whitelist = {
    "Product_1": {
      "HWID_1": "SCRIPT_KEY_1",
      "HWID_2": "SCRIPT_KEY_2"
    },
    "Product_2": {
      "HWID_3": "SCRIPT_KEY_3",
      "HWID_4": "SCRIPT_KEY_4"
    },
    // Thêm các sản phẩm và HWID tương ứng ở đây
  };

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { hwid, script_key, product } = req.body;

  // Kiểm tra xem HWID và script key có hợp lệ với sản phẩm không
  if (
    product in whitelist &&
    hwid in whitelist[product] &&
    whitelist[product][hwid] === script_key
  ) {
    return res.status(200).json({ status: 'success', message: 'Access granted' });
  } else {
    return res.status(403).json({ status: 'error', message: 'Access denied' });
  }
}
