# 🔧 Troubleshooting

Common issues and solutions for ZtoApi.

## 🛠️ Common Issues

- **401 Unauthorized** — check Authorization header format: "Authorization: Bearer your-key" 🔑
- **502 Bad Gateway** — upstream Z.ai error or network issue; check UPSTREAM_URL and ZAI_TOKEN 🌐
- **Streaming interrupted** — network instability; set "stream": false to disable SSE 🌊
- **Multimodal failures** — ensure ZAI_TOKEN is set and media sizes/formats are supported 🎥🖼️

## 🐛 Debugging

Enable verbose logs with DEBUG_MODE=true to see what's happening under the hood! 🔍

```bash
deno run --allow-net --allow-env --allow-read main.ts
```

## 🛡️ Security Tips

Keep your API secure with these tips! 🛡️

- Use a long, random DEFAULT_KEY 🔑
- Set DEBUG_MODE=false in production 🚫
- Rotate keys regularly 🔄

For more advanced topics, see [Advanced](../docs/advanced.md).