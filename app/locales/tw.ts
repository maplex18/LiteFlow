import { getClientConfigSync } from "../config/client";
import { SubmitKey } from "../store/config";

const isApp = !!getClientConfigSync("isApp", false);

const tw = {
  WIP: "此功能仍在開發中……",
  Error: {
    Unauthorized: isApp
      ? `😆 對話遇到了一些問題，不用慌:
    \\ 2️⃣ 如果你想消耗自己的 OpenAI 資源，點選[這裡](/#/settings)修改設定 ⚙️`
      : `😆 對話遇到了一些問題，不用慌:
    \ 1️⃣ 如果你想消耗自己的 OpenAI 資源，點選[這裡](/#/settings)修改設定 ⚙️
 `,
  },

  Auth: {
    Title: "需要密碼",
    Tips: "管理員開啟了密碼驗證，請在下方填入存取密碼",
    SubTips: "或者輸入你的 OpenAI 或 Google API 金鑰",
    Input: "在此處填寫存取密碼",
    Confirm: "確認",
    Later: "稍候再說",
    Return: "返回",
    SaasTips: "設定太麻煩，想要立即使用",
    TopTips:
      "🥳 LeoPilot Lite 首發優惠，立刻解鎖 OpenAI o1, GPT-4o, Claude-3.5 等最新的大型語言模型",
    Unauthorized: "未經授權的訪問",
    Forbidden: "禁止訪問",
    LogoutSuccess: "登出成功",
  },
  ChatItem: {
    ChatItemCount: (count: number) => `${count} 則對話`,
  },
  Chat: {
    SubTitle: (count: number) => `您已經與 ChatGPT 進行了 ${count} 則對話`,
    EditMessage: {
      Title: "編輯訊息記錄",
      Topic: {
        Title: "聊天主題",
        SubTitle: "更改目前聊天主題",
      },
    },
    Actions: {
      ChatList: "檢視訊息列表",
      CompressedHistory: "檢視壓縮後的歷史 Prompt",
      Export: "匯出聊天紀錄",
      Copy: "複製",
      Stop: "停止",
      Retry: "重試",
      Pin: "固定",
      PinToastContent: "已將 1 條對話固定至預設提示詞",
      PinToastAction: "檢視",
      Delete: "刪除",
      Edit: "編輯",
      RefreshTitle: "重新整理標題",
      RefreshToast: "已傳送重新整理標題請求",
      Speech: "朗讀",
      StopSpeech: "停止",
    },
    Commands: {
      new: "新建聊天",
      newm: "從大獅範本新建聊天",
      lite: "下一個聊天",
      prev: "上一個聊天",
      clear: "清除上下文",
      del: "刪除聊天",
    },
    InputActions: {
      Stop: "停止回應",
      ToBottom: "移至最新",
      Theme: {
        auto: "自動主題",
        light: "亮色模式",
        dark: "深色模式",
      },
      Prompt: "快捷指令",
      Masks: "所有大獅範本",
      Clear: "清除聊天",
      Settings: "對話設定",
      UploadImage: "上傳圖片",
    },
    Rename: "重新命名對話",
    Typing: "正在輸入…",
    Input: (submitKey: string) => {
      var inputHints = `輸入訊息後，按下 ${submitKey} 鍵即可傳送`;
      if (submitKey === String(SubmitKey.Enter)) {
        inputHints += "，Shift + Enter 鍵換行";
      }
      return inputHints;
    },
    Send: "傳送",
    StartSpeak: "開始說話",
    StopSpeak: "停止說話",
    Config: {
      Reset: "重設",
      SaveAs: "另存新檔",
    },
    IsContext: "預設提示詞",
    ShortcutKey: {
      Title: "鍵盤快捷方式",
      newChat: "開啟新聊天",
      focusInput: "聚焦輸入框",
      copyLastMessage: "複製最後一個回覆",
      copyLastCode: "複製最後一個程式碼區塊",
      showShortcutKey: "顯示快捷方式",
    },
  },
  Export: {
    Title: "匯出聊天記錄",
    Copy: "複製全部",
    Download: "下載檔案",
    Share: "分享到 ShareGPT",
    MessageFromYou: "你的訊息",
    MessageFromChatGPT: "ChatGPT 的訊息",
    Format: {
      Title: "匯出格式",
      SubTitle: "Markdown 或 PNG 圖片",
    },
    IncludeContext: {
      Title: "包含上下文",
      SubTitle: "是否在匯出中包含 Mask 上下文",
    },
    Steps: {
      Select: "選取",
      Preview: "預覽",
    },
    Image: {
      Toast: "正在生成截圖...",
      Modal: "長按或右鍵儲存圖片",
    },
    Artifacts: {
      Title: "分享成品",
      Error: "分享失敗",
    },
  },
  Select: {
    Search: "查詢訊息",
    All: "選取全部",
    Latest: "最近幾條",
    Clear: "清除選取",
  },
  Memory: {
    Title: "上下文記憶 Prompt",
    EmptyContent: "尚未記憶",
    Copy: "複製全部",
    Send: "傳送記憶",
    Reset: "重設對話",
    ResetConfirm: "重設後將清除目前對話記錄以及歷史記憶，確認重設？",
  },
  Home: {
    NewChat: "開新對話",
    DeleteChat: "確定要刪除選取的對話嗎？",
    DeleteToast: "已刪除對話",
    Revert: "撤銷",
  },
  Settings: {
    Title: "設定",
    SubTitle: "設定選項",

    Danger: {
      Reset: {
        Title: "重設所有設定",
        SubTitle: "重設所有設定項回預設值",
        Action: "立即重設",
        Confirm: "確認重設所有設定？",
      },
      Clear: {
        Title: "清除所有資料",
        SubTitle: "清除所有聊天、設定資料",
        Action: "立即清除",
        Confirm: "確認清除所有聊天、設定資料？",
      },
    },
    Lang: {
      Name: "Language", // ATTENTION: if you wanna add a new translation, please do not translate this value, leave it as `Language`
      All: "所有語言",
    },
    Avatar: "大頭貼",
    FontSize: {
      Title: "字型大小",
      SubTitle: "聊天內容的字型大小",
    },
    FontFamily: {
      Title: "聊天字型",
      SubTitle: "聊天內容的字型，若留空則套用全域預設字型",
      Placeholder: "字型名稱",
    },
    InjectSystemPrompts: {
      Title: "匯入系統提示",
      SubTitle: "強制在每個請求的訊息列表開頭新增一個模擬 ChatGPT 的系統提示",
    },
    InputTemplate: {
      Title: "使用者輸入預處理",
      SubTitle: "使用者最新的一則訊息會填充到此範本",
    },

    Update: {
      Version: (x: string) => `目前版本：${x}`,
      IsLatest: "已是最新版本",
      CheckUpdate: "檢查更新",
      IsChecking: "正在檢查更新...",
      FoundUpdate: (x: string) => `發現新版本：${x}`,
      GoToUpdate: "前往更新",
    },
    SendKey: "傳送鍵",
    Theme: "主題",
    TightBorder: "緊湊邊框",
    SendPreviewBubble: {
      Title: "預覽氣泡",
      SubTitle: "在預覽氣泡中預覽 Markdown 內容",
    },
    AutoGenerateTitle: {
      Title: "自動產生標題",
      SubTitle: "根據對話內容產生合適的標題",
    },
    Provider: {
      Status: "模型供應商狀態",
      SubStatus: "查看目前可用的模型供應商",
      Current: "當前使用的供應商",
      CurrentStatus: "當前供應商的狀態"
    },
    Sync: {
      CloudState: "雲端資料",
      NotSyncYet: "還沒有進行過同步",
      Success: "同步成功",
      Fail: "同步失敗",

      Config: {
        Modal: {
          Title: "設定雲端同步",
          Check: "檢查可用性",
        },
        SyncType: {
          Title: "同步類型",
          SubTitle: "選擇偏好的同步伺服器",
        },
        Proxy: {
          Title: "啟用代理伺服器",
          SubTitle: "在瀏覽器中同步時，啟用代理伺服器以避免跨域限制",
        },
        ProxyUrl: {
          Title: "代理伺服器位置",
          SubTitle: "僅適用於本專案內建的跨域代理",
        },

        WebDav: {
          Endpoint: "WebDAV 位置",
          UserName: "使用者名稱",
          Password: "密碼",
        },

        UpStash: {
          Endpoint: "UpStash Redis REST Url",
          UserName: "備份名稱",
          Password: "UpStash Redis REST Token",
        },
      },

      LocalState: "本機資料",
      Overview: (overview: any) => {
        return `${overview.chat} 次對話，${overview.message} 則訊息，${overview.prompt} 條提示詞，${overview.mask} 個大獅範本`;
      },
      ImportFailed: "匯入失敗",
    },
    Mask: {
      Splash: {
        Title: "大獅範本啟動頁面",
        SubTitle: "新增聊天時，呈現大獅範本啟動頁面",
      },
      Builtin: {
        Title: "隱藏內建大獅範本",
        SubTitle: "在所有大獅範本列表中隱藏內建大獅範本",
      },
    },
    Prompt: {
      Disable: {
        Title: "停用提示詞自動補齊",
        SubTitle: "在輸入框開頭輸入 / 即可觸發自動補齊",
      },
      List: "自訂提示詞列表",
      ListCount: (builtin: number, custom: number) =>
        `內建 ${builtin} 條，使用者自訂 ${custom} 條`,
      Edit: "編輯",
      Modal: {
        Title: "提示詞列表",
        Add: "新增一則",
        Search: "搜尋提示詞",
      },
      EditModal: {
        Title: "編輯提示詞",
      },
    },
    HistoryCount: {
      Title: "附帶歷史訊息數",
      SubTitle: "每次請求附帶的歷史訊息數",
    },
    CompressThreshold: {
      Title: "歷史訊息長度壓縮閾值",
      SubTitle: "當未壓縮的歷史訊息超過該值時，將進行壓縮",
    },

    Usage: {
      Title: "帳戶餘額",
      SubTitle(used: any, total: any) {
        return `本月已使用 $${used}，訂閱總額 $${total}`;
      },
      IsChecking: "正在檢查…",
      Check: "重新檢查",
      NoAccess: "輸入 API Key 檢視餘額",
    },

    Access: {
      SaasStart: {
        Title: "使用 LeoPilot Lite",
        Label: "(性價比最高的方案)",
        SubTitle:
          "由 LeoPilot Lite 官方維護，無須設定開箱即用，支援 OpenAI o1、GPT-4o、Claude-3.5 等最新的大型語言模型",
        ChatNow: "立刻開始對話",
      },

      AccessCode: {
        Title: "存取密碼",
        SubTitle: "管理員已開啟加密存取",
        Placeholder: "請輸入存取密碼",
      },
      CustomEndpoint: {
        Title: "自訂 API 端點 (Endpoint)",
        SubTitle: "是否使用自訂 Azure 或 OpenAI 服務",
      },
      Provider: {
        Title: "模型供應商",
        SubTitle: "切換不同的服務供應商",
      },
      OpenAI: {
        ApiKey: {
          Title: "API Key",
          SubTitle: "使用自訂 OpenAI Key 繞過密碼存取限制",
          Placeholder: "OpenAI API Key",
        },

        Endpoint: {
          Title: "API 端點 (Endpoint) 位址",
          SubTitle: "除預設位址外，必須包含 http(s)://",
        },
      },
      Azure: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "使用自訂 Azure Key 繞過密碼存取限制",
          Placeholder: "Azure API Key",
        },

        Endpoint: {
          Title: "API 端點 (Endpoint) 位址",
          SubTitle: "範例：",
        },

        ApiVerion: {
          Title: "API 版本 (azure api version)",
          SubTitle: "指定一個特定的 API 版本",
        },
      },
      Anthropic: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "從 Anthropic AI 取得您的 API 金鑰",
          Placeholder: "Anthropic API Key",
        },

        Endpoint: {
          Title: "端點位址",
          SubTitle: "範例：",
        },

        ApiVerion: {
          Title: "API 版本 (claude api version)",
          SubTitle: "指定一個特定的 API 版本",
        },
      },
      Google: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "從 Google AI 取得您的 API 金鑰",
          Placeholder: "輸入您的 Google AI Studio API 金鑰",
        },

        Endpoint: {
          Title: "端點位址",
          SubTitle: "範例：",
        },

        ApiVersion: {
          Title: "API 版本（僅適用於 gemini-pro）",
          SubTitle: "選擇一個特定的 API 版本",
        },
        GoogleSafetySettings: {
          Title: "Google 安全過濾等級",
          SubTitle: "設定內容過濾等級",
        },
      },
      Baidu: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "使用自訂 Baidu API 金鑰",
          Placeholder: "Baidu API 金鑰",
        },
        SecretKey: {
          Title: "密鑰",
          SubTitle: "使用自訂 Baidu 密鑰",
          Placeholder: "Baidu 密鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "不支援自訂，請前往 .env 設定",
        },
      },
      Tencent: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "使用自訂騰訊雲 API 金鑰",
          Placeholder: "騰訊雲 API 金鑰",
        },
        SecretKey: {
          Title: "密鑰",
          SubTitle: "使用自訂騰訊雲密鑰",
          Placeholder: "騰訊雲密鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "不支援自訂，請前往 .env 設定",
        },
      },
      ByteDance: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂 ByteDance API 金鑰",
          Placeholder: "ByteDance API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Alibaba: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂阿里雲 API 金鑰",
          Placeholder: "阿里雲 API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Moonshot: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂月之暗面 API 金鑰",
          Placeholder: "月之暗面 API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      XAI: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂 XAI API 金鑰",
          Placeholder: "XAI API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      ChatGLM: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂 ChatGLM API 金鑰",
          Placeholder: "ChatGLM API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Stability: {
        ApiKey: {
          Title: "介面密鑰",
          SubTitle: "使用自訂 Stability API 金鑰",
          Placeholder: "Stability API 金鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Iflytek: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "從訊飛星火控制台取得的 API 金鑰",
          Placeholder: "API 金鑰",
        },
        ApiSecret: {
          Title: "API 密鑰",
          SubTitle: "從訊飛星火控制台取得的 API 密鑰",
          Placeholder: "API 密鑰",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      CustomModel: {
        Title: "自訂模型名稱",
        SubTitle: "增加自訂模型可選擇項目，使用英文逗號隔開",
      },
    },

    Model: "模型 (model)",
    CompressModel: {
      Title: "壓縮模型",
      SubTitle: "用於壓縮歷史記錄的模型",
    },
    Temperature: {
      Title: "隨機性 (temperature)",
      SubTitle: "值越大，回應越隨機",
    },
    TopP: {
      Title: "核心採樣 (top_p)",
      SubTitle: "與隨機性類似，但不要和隨機性一起更改",
    },
    MaxTokens: {
      Title: "單次回應限制 (max_tokens)",
      SubTitle: "單次互動所用的最大 Token 數",
    },
    PresencePenalty: {
      Title: "話題新穎度 (presence_penalty)",
      SubTitle: "值越大，越有可能拓展到新話題",
    },
    FrequencyPenalty: {
      Title: "頻率懲罰度 (frequency_penalty)",
      SubTitle: "值越大，越有可能降低重複字詞",
    },
    TTS: {
      Enable: {
        Title: "啟用文字轉語音",
        SubTitle: "啟用文字生成語音服務",
      },
      Autoplay: {
        Title: "啟用自動朗讀",
        SubTitle: "自動生成語音並播放，需先開啟文字轉語音開關",
      },
      Model: "模型",
      Engine: "轉換引擎",
      Voice: {
        Title: "聲音",
        SubTitle: "生成語音時使用的聲音",
      },
      Speed: {
        Title: "速度",
        SubTitle: "生成語音的速度",
      },
    },
    Realtime: {
      Enable: {
        Title: "即時聊天",
        SubTitle: "開啟即時聊天功能",
      },
      Provider: {
        Title: "模型服務商",
        SubTitle: "切換不同的服務商",
      },
      Model: {
        Title: "模型",
        SubTitle: "選擇一個模型",
      },
      ApiKey: {
        Title: "API 金鑰",
        SubTitle: "API 金鑰",
        Placeholder: "API 金鑰",
      },
      Azure: {
        Endpoint: {
          Title: "介面位址",
          SubTitle: "介面位址",
        },
        Deployment: {
          Title: "部署名稱",
          SubTitle: "部署名稱",
        },
      },
      Temperature: {
        Title: "隨機性",
        SubTitle: "數值越大，回覆越隨機",
      },
    },
  },
  Store: {
    DefaultTopic: "新的對話",
    BotHello: "請問需要我的協助嗎？",
    Error: "出錯了，請稍後再嘗試",
    Prompt: {
      History: (content: string) =>
        "這是 AI 與使用者的歷史聊天總結，作為前情提要：" + content,
      Topic:
        "Use the language used by the user (e.g. en for english conversation, zh-hant for chinese conversation, etc.) to generate a title (at most 6 words) summarizing our conversation without any lead-in, quotation marks, preamble like 'Title:', direct text copies, single-word replies, quotation marks, translations, or brackets. Remove enclosing quotation marks. The title should make third-party grasp the essence of the conversation in first sight.",
      Summarize:
        "Use the language used by the user (e.g. en-us for english conversation, zh-hant for chinese conversation, etc.) to summarise the conversation in at most 200 words. The summary will be used as prompt for you to continue the conversation in the future.",
    },
  },
  Copy: {
    Success: "已複製到剪貼簿中",
    Failed: "複製失敗，請賦予剪貼簿權限",
  },
  Download: {
    Success: "內容已下載到您的目錄。",
    Failed: "下載失敗。",
  },
  Context: {
    Toast: (x: any) => `已設定 ${x} 條前置上下文`,
    Edit: "前置上下文和歷史記憶",
    Add: "新增一則",
    Clear: "上下文已清除",
    Revert: "恢復上下文",
  },
  Discovery: {
    Name: "探索",
  },
  FineTuned: {
    Sysmessage: "你是一個助手",
  },
  Plugin: {
    Name: "外掛",
    Page: {
      Title: "外掛",
      SubTitle: (count: number) => `${count} 個外掛`,
      Search: "搜尋外掛",
      Create: "新增",
      Find: "您可以在 Github 上找到優秀的外掛：",
    },
    Item: {
      Info: (count: number) => `${count} 種方法`,
      View: "檢視",
      Edit: "編輯",
      Delete: "刪除",
      DeleteConfirm: "確定要刪除？",
    },
    Auth: {
      None: "不需要授權",
      Basic: "基本",
      Bearer: "Bearer",
      Custom: "自訂",
      CustomHeader: "自訂參數名稱",
      Token: "權杖",
      Proxy: "使用代理",
      ProxyDescription: "使用代理解決 CORS 錯誤",
      Location: "位置",
      LocationHeader: "標頭",
      LocationQuery: "查詢",
      LocationBody: "內文",
    },
    EditModal: {
      Title: (readonly: boolean) => `編輯外掛 ${readonly ? "（唯讀）" : ""}`,
      Download: "下載",
      Auth: "授權方式",
      Content: "OpenAPI 架構",
      Load: "從網頁載入",
      Method: "方法",
      Error: "格式錯誤",
    },
  },
  Mask: {
    Name: "大獅範本",
    Page: {
      Title: "預設大獅範本",
      SubTitle: (count: number) => `${count} 個預設大獅定義`,
      Search: "搜尋大獅範本",
      Create: "新增",
    },
    Item: {
      Info: (count: number) => `包含 ${count} 條預設對話`,
      Chat: "對話",
      View: "檢視",
      Edit: "編輯",
      Delete: "刪除",
      DeleteConfirm: "確認刪除？",
    },
    EditModal: {
      Title: (readonly: boolean) =>
        `編輯預設大獅範本 ${readonly ? "（唯讀）" : ""}`,
      Download: "下載預設值",
      Clone: "以此預設值建立副本",
    },
    Config: {
      Avatar: "角色頭像",
      Name: "角色名稱",
      Sync: {
        Title: "使用全域設定",
        SubTitle: "目前對話是否使用全域模型設定",
        Confirm: "目前對話的自訂設定將會被自動覆蓋，確認啟用全域設定？",
      },
      HideContext: {
        Title: "隱藏預設對話",
        SubTitle: "隱藏後預設對話不會出現在聊天介面（系統提示始終隱藏）",
      },
      Artifacts: {
        Title: "啟用 Artifacts",
        SubTitle: "啟用後可以直接轉譯 HTML 頁面",
      },
      CodeFold: {
        Title: "啟用程式碼摺疊",
        SubTitle: "啟用後可以自動摺疊/展開過長的程式碼區塊",
      },
      Share: {
        Title: "分享此大獅範本",
        SubTitle: "產生此大獅範本的直達連結",
        Action: "複製連結",
      },
    },
  },
  SearchChat: {
    Name: "搜尋",
    Page: {
      Title: "搜尋聊天記錄",
      Search: "輸入搜尋關鍵詞",
      NoResult: "沒有找到結果",
      NoData: "沒有資料",
      Loading: "載入中",

      SubTitle: (count: number) => `找到 ${count} 條結果`,
    },
    Item: {
      View: "檢視",
    },
  },
  NewChat: {
    Return: "返回",
    Skip: "跳過",
    NotShow: "不再顯示",
    ConfirmNoShow: "確認停用？停用後可以隨時在設定中重新啟用。",
    Title: "挑選一個大獅範本",
    SubTitle: "現在開始，與大獅範本背後的靈魂思維碰撞",
    More: "搜尋更多",
  },
  URLCommand: {
    Code: "偵測到連結中已經包含存取密碼，是否自動填入？",
    Settings: "偵測到連結中包含了預設設定，是否自動填入？",
  },
  UI: {
    Confirm: "確認",
    Cancel: "取消",
    Close: "關閉",
    Create: "新增",
    Edit: "編輯",
    Export: "匯出",
    Import: "匯入",
    Sync: "同步",
    Config: "設定",
  },
  Exporter: {
    Description: {
      Title: "只有清除上下文之後的訊息會被顯示",
    },
    Model: "模型",
    Messages: "訊息",
    Topic: "主題",
    Time: "時間",
  },
  SdPanel: {
    Prompt: "畫面提示",
    NegativePrompt: "反向提示",
    PleaseInput: (name: string) => `請輸入${name}`,
    AspectRatio: "長寬比",
    ImageStyle: "圖像風格",
    OutFormat: "輸出格式",
    AIModel: "AI模型",
    ModelVersion: "模型版本",
    Submit: "提交產生",
    ParamIsRequired: (name: string) => `${name}不能為空`,
    Styles: {
      D3Model: "3D模型",
      AnalogFilm: "類比電影",
      Anime: "動漫",
      Cinematic: "電影風格",
      ComicBook: "漫畫書",
      DigitalArt: "數位藝術",
      Enhance: "增強",
      FantasyArt: "奇幻藝術",
      Isometric: "等角",
      LineArt: "線描",
      LowPoly: "低多邊形",
      ModelingCompound: "建模材料",
      NeonPunk: "霓虹龐克",
      Origami: "摺紙",
      Photographic: "攝影",
      PixelArt: "像素藝術",
      TileTexture: "貼圖",
    },
  },
  Sd: {
    SubTitle: (count: number) => `共 ${count} 張圖片`,
    Actions: {
      Params: "檢視參數",
      Copy: "複製提示詞",
      Delete: "刪除",
      Retry: "重新嘗試",
      ReturnHome: "回到首頁",
      History: "檢視歷史紀錄",
    },
    EmptyRecord: "目前尚無繪圖紀錄",
    Status: {
      Name: "狀態",
      Success: "成功",
      Error: "失敗",
      Wait: "等候中",
      Running: "執行中",
    },
    Danger: {
      Delete: "確定要刪除？",
    },
    GenerateParams: "生成參數",
    Detail: "詳細資訊",
  },
  UserList: {
    Error: "獲取用戶列表失敗",
    DeleteFailed: "刪除用戶失敗",
    DeleteSuccess: "刪除用戶成功",
    ChangePasswordFailed: "修改密碼失敗",
    ChangePasswordSuccess: "修改密碼成功",
  },
};

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type LocaleType = typeof tw;
export type PartialLocaleType = DeepPartial<typeof tw>;

export default tw;
// Translated by @chunkiuuu, feel free the submit new pr if there are typo/incorrect translations :D
