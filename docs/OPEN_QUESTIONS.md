# OPEN QUESTIONS — Studio + Custom Agent

Format: `STUDIO-XXX`, status `Terbuka / Dijawab / Dibatalkan`.
Aturan adaptasi dokumenpembelajaran AGENTS.md 8: ambigu = hentikan, catat di sini.

| ID | Pertanyaan | Status | Catatan |
|----|------------|--------|---------|
| STUDIO-001 | MCP server eksternal (stdio/SSE) perlu dibuat agar Claude/Opencode bisa memanggil tools studio? | Terbuka | Opsi B; wrapper di atas `AGENT_TOOLS` + `agent:invoke`. |
| STUDIO-002 | Izin tulis agent: apakah `content.create/transition` dan `render.enqueue` butuh konfirmasi user per aksi? | Terbuka | Menentukan UX + audit log. |
| STUDIO-003 | Batas kuota render agent: `maxConcurrentRender` + retry policy per agent perlu dibedakan dari user manual? | Terbuka | Menentukan `render-queue` policy. |
