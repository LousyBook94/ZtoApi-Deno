## Documentation Index

Start here:
- README.md (overview)
- QUICK_REFERENCE.md (cheat sheet)
- ARCHITECTURE.md (how its built)
- MIGRATION_GUIDE.md (where things moved)

User docs (docs/):
- getting-started.md, deployment.md, api-reference.md
- models.md, features.md, examples.md
- troubleshooting.md, advanced.md, docs/README.md

Dev topics:
- src/config/ (constants, models)
- src/services/ (signature, headers, images, tokens, upstream)
- src/utils/ (logger, helpers, stats, stream)
- src/types/ (common, openai, upstream)
- src/handlers/ (models)

Run:
- Deno: deno task start
- Docker: docker build -t ztoapi . && docker run -p 9090:9090 ztoapi

Test (manual):
- curl http://localhost:9090/v1/models
- curl -s -X POST http://localhost:9090/v1/chat/completions \
  -H "Authorization: Bearer sk-test" -H "Content-Type: application/json" \
  -d '{"model":"GLM-4.5","messages":[{"role":"user","content":"ping"}],"stream":false}'

