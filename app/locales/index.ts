import cn from "./cn";
import en from "./en";
import pt from "./pt";
import tw from "./tw";
import id from "./id";
import fr from "./fr";
import es from "./es";
import it from "./it";
import tr from "./tr";
import jp from "./jp";
import de from "./de";
import vi from "./vi";
import ru from "./ru";
import no from "./no";
import cs from "./cs";
import ko from "./ko";
import ar from "./ar";
import bn from "./bn";
import sk from "./sk";
import { merge } from "../utils/merge";
import { safeLocalStorage } from "@/app/utils";

import type { LocaleType } from "./cn";
export type { LocaleType, PartialLocaleType } from "./cn";

const localStorage = safeLocalStorage();

const ALL_LANGS = {
  cn,
  en,
  tw,
  pt,
  jp,
  ko,
  id,
  fr,
  es,
  it,
  tr,
  de,
  vi,
  ru,
  cs,
  no,
  ar,
  bn,
  sk,
};

export type Lang = keyof typeof ALL_LANGS;

export const AllLangs = Object.keys(ALL_LANGS) as Lang[];

export const ALL_LANG_OPTIONS: Record<Lang, string> = {
  cn: "简体中文",
  en: "English",
  pt: "Português",
  tw: "繁體中文",
  jp: "日本語",
  ko: "한국어",
  id: "Indonesia",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  tr: "Türkçe",
  de: "Deutsch",
  vi: "Tiếng Việt",
  ru: "Русский",
  cs: "Čeština",
  no: "Nynorsk",
  ar: "العربية",
  bn: "বাংলা",
  sk: "Slovensky",
};

export const LANG_KEY = "lang";
const DEFAULT_LANG = "tw";

const fallbackLang = tw;
const targetLang = ALL_LANGS[getLang()] as LocaleType;

// if target lang missing some fields, it will use fallback lang string
merge(fallbackLang, targetLang);

// Add debug logging

// 使用 'as unknown as LocaleType' 來避開類型檢查錯誤
export default fallbackLang as unknown as LocaleType;

export function setItem(key: string, value: string) {
  localStorage.setItem(key, value);
}

function getItem(key: string) {
  return localStorage.getItem(key);
}

function getLanguage() {
  try {
    const locale = new Intl.Locale(navigator.language).maximize();
    const region = locale?.region?.toLowerCase();
    // 1. check region code in ALL_LANGS
    if (AllLangs.includes(region as Lang)) {
      return region as Lang;
    }
    // 2. check language code in ALL_LANGS
    if (AllLangs.includes(locale.language as Lang)) {
      return locale.language as Lang;
    }
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function getLang(): Lang {
  try {
    // 先從 config 中獲取語言設置
    const configStr = localStorage.getItem("app-config");
    if (configStr) {
      const config = JSON.parse(configStr);
      if (config.lang && AllLangs.includes(config.lang as Lang)) {
        return config.lang as Lang;
      }
    }

    // 如果 config 中沒有，再檢查獨立的語言設置
    const savedLang = getItem(LANG_KEY);
    if (AllLangs.includes((savedLang ?? "") as Lang)) {
      return savedLang as Lang;
    }

    // 如果都沒有，使用默認語言
    return DEFAULT_LANG;
  } catch (e) {
    console.error("[Lang] failed to get language:", e);
    return DEFAULT_LANG;
  }
}

export function changeLang(lang: Lang) {
  setItem(LANG_KEY, lang);
  location.reload();
}

export function getISOLang() {
  const isoLangString: Record<string, string> = {
    cn: "zh-Hans",
    tw: "zh-Hant",
  };

  const lang = getLang();
  return isoLangString[lang] ?? lang;
}

const DEFAULT_STT_LANG = "zh-CN";
export const STT_LANG_MAP: Record<Lang, string> = {
  cn: "zh-CN",
  en: "en-US",
  pt: "pt-BR",
  tw: "zh-TW",
  jp: "ja-JP",
  ko: "ko-KR",
  id: "id-ID",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  tr: "tr-TR",
  de: "de-DE",
  vi: "vi-VN",
  ru: "ru-RU",
  cs: "cs-CZ",
  no: "no-NO",
  ar: "ar-SA",
  bn: "bn-BD",
  sk: "sk-SK",
};

export function getSTTLang(): string {
  try {
    return STT_LANG_MAP[getLang()];
  } catch {
    return DEFAULT_STT_LANG;
  }
}
