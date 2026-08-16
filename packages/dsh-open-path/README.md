# dsh-open-path

Open local file/folder paths in Explorer from chat.

- Host route: `POST /api/open-path` with `{ "path": "C:\\...\\folder" }`.
- Browser behavior: none. The conversation bubble renderer (ui-conversation
  fork) linkifies Windows absolute paths in user messages and calls this route
  on click, so `C:\Users\...` renders as a clickable link that opens in
  Explorer (folder opens a window, file opens with its default program).
- Path validation: drive-letter or UNC absolute paths only; must exist on the
  host; quoted paths (复制为路径 style) are accepted.