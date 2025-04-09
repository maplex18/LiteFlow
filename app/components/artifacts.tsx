import {
  useEffect,
  useState,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useParams } from "react-router";
import { IconButton } from "./button";
import { nanoid } from "nanoid";
import ExportIcon from "../icons/share.svg";
import CopyIcon from "../icons/copy.svg";
import DownloadIcon from "../icons/download.svg";
import GithubIcon from "../icons/github.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import ReloadButtonIcon from "../icons/reload.svg";
import Locale from "../locales";
import { Modal, showToast } from "./ui-lib";
import { copyToClipboard, downloadAs } from "../utils";
import { Path, ApiPath, REPO_URL } from "@/app/constant";
import { Loading } from "./home";
import styles from "./artifacts.module.scss";

// Make sure Locale is properly initialized


// Fallback texts in case translations are missing
const FALLBACK_TEXTS = {
  SHARE_TITLE: "Share Artifacts",
  SHARE_ERROR: "Share Error",
  DOWNLOAD: "Download",
  COPY: "Copy",
};

type HTMLPreviewProps = {
  code: string;
  autoHeight?: boolean;
  height?: number | string;
  onLoad?: (title?: string) => void;
};

export type HTMLPreviewHander = {
  reload: () => void;
};

export function ArtifactsShareButton({
  getCode,
  id,
  style,
  fileName,
}: {
  getCode: () => string;
  id?: string;
  style?: any;
  fileName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(id || "");
  const [show, setShow] = useState(false);
  const shareUrl = useMemo(
    () => {
      if (!name) return "";
      try {
        const baseUrl = window?.location?.origin || "";
        return [baseUrl, "#", Path.Artifacts, "/", name].filter(Boolean).join("");
      } catch (e) {
        console.error("[Share]", e);
        return ["#", Path.Artifacts, "/", name].join("");
      }
    },
    [name],
  );

  const upload = async (code: string) => {
    if (!code) {
      showToast(Locale?.Export?.Artifacts?.Error || FALLBACK_TEXTS.SHARE_ERROR);
      return null;
    }

    if (id) {
      return { id };
    }

    try {
      const response = await fetch(ApiPath.Artifacts, {
        method: "POST",
        body: code,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.id) {
        throw new Error("No ID returned");
      }

      return data;
    } catch (e) {
      console.error("[Upload]", e);
      showToast(Locale?.Export?.Artifacts?.Error || FALLBACK_TEXTS.SHARE_ERROR);
      return null;
    }
  };

  const handleShare = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      const code = getCode();
      const result = await upload(code);
      
      if (result?.id) {
        setName(result.id);
        setShow(true);
      }
    } catch (e) {
      console.error("[Share]", e);
      showToast(Locale?.Export?.Artifacts?.Error || FALLBACK_TEXTS.SHARE_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="window-action-button" style={style}>
        <IconButton
          icon={loading ? <LoadingButtonIcon /> : <ExportIcon />}
          bordered
          title={Locale?.Export?.Artifacts?.Title || FALLBACK_TEXTS.SHARE_TITLE}
          onClick={handleShare}
          disabled={loading}
        />
      </div>
      {show && shareUrl && (
        <div className="modal-mask">
          <Modal
            title={Locale?.Export?.Artifacts?.Title || FALLBACK_TEXTS.SHARE_TITLE}
            onClose={() => setShow(false)}
            actions={[
              <IconButton
                key="download"
                icon={<DownloadIcon />}
                bordered
                text={Locale?.Export?.Download || FALLBACK_TEXTS.DOWNLOAD}
                onClick={() => {
                  downloadAs(getCode(), `${fileName || name}.html`).then(() =>
                    setShow(false),
                  );
                }}
              />,
              <IconButton
                key="copy"
                icon={<CopyIcon />}
                bordered
                text={Locale?.Chat?.Actions?.Copy || FALLBACK_TEXTS.COPY}
                onClick={() => {
                  copyToClipboard(shareUrl).then(() => setShow(false));
                }}
              />,
            ]}
          >
            <div>
              {shareUrl && (
                <a target="_blank" href={shareUrl} rel="noopener noreferrer">
                  {shareUrl}
                </a>
              )}
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}

export const HTMLPreview = forwardRef<HTMLPreviewHander, HTMLPreviewProps>(
  function HTMLPreview(props, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [frameId, setFrameId] = useState<string>(nanoid());
    const [iframeHeight, setIframeHeight] = useState(600);
    const [title, setTitle] = useState("");
    /*
     * https://stackoverflow.com/questions/19739001/what-is-the-difference-between-srcdoc-and-src-datatext-html-in-an
     * 1. using srcdoc
     * 2. using src with dataurl:
     *    easy to share
     *    length limit (Data URIs cannot be larger than 32,768 characters.)
     */

    useEffect(() => {
      const handleMessage = (e: any) => {
        const { id, height, title } = e.data;
        setTitle(title);
        if (id == frameId) {
          setIframeHeight(height);
        }
      };
      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }, [frameId]);

    useImperativeHandle(ref, () => ({
      reload: () => {
        setFrameId(nanoid());
      },
    }));

    const height = useMemo(() => {
      if (!props.autoHeight) return props.height || 600;
      if (typeof props.height === "string") {
        return props.height;
      }
      const parentHeight = props.height || 600;
      return iframeHeight + 40 > parentHeight
        ? parentHeight
        : iframeHeight + 40;
    }, [props.autoHeight, props.height, iframeHeight]);

    const srcDoc = useMemo(() => {
      const script = `<script>window.addEventListener("DOMContentLoaded", () => new ResizeObserver((entries) => parent.postMessage({id: '${frameId}', height: entries[0].target.clientHeight}, '*')).observe(document.body))</script>`;
      if (props.code.includes("<!DOCTYPE html>")) {
        props.code.replace("<!DOCTYPE html>", "<!DOCTYPE html>" + script);
      }
      return script + props.code;
    }, [props.code, frameId]);

    const handleOnLoad = () => {
      if (props?.onLoad) {
        props.onLoad(title);
      }
    };

    return (
      <iframe
        className={styles["artifacts-iframe"]}
        key={frameId}
        ref={iframeRef}
        sandbox="allow-forms allow-modals allow-scripts"
        style={{ height }}
        srcDoc={srcDoc}
        onLoad={handleOnLoad}
      />
    );
  },
);

export function Artifacts() {
  const { id } = useParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const previewRef = useRef<HTMLPreviewHander>(null);

  useEffect(() => {
    if (id) {
      fetch(`${ApiPath.Artifacts}?id=${id}`)
        .then((res) => {
          if (res.status > 300) {
            throw Error("can not get content");
          }
          return res;
        })
        .then((res) => res.text())
        .then(setCode)
        .catch((e) => {
          showToast(Locale.Export.Artifacts.Error);
        });
    }
  }, [id]);

  return (
    <div className={styles["artifacts"]}>
      <div className={styles["artifacts-header"]}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <IconButton bordered icon={<GithubIcon />} shadow />
        </a>
        <IconButton
          bordered
          style={{ marginLeft: 20 }}
          icon={<ReloadButtonIcon />}
          shadow
          onClick={() => previewRef.current?.reload()}
        />
        <div className={styles["artifacts-title"]}>LeoPilot Lite Artifacts</div>
        <ArtifactsShareButton
          id={id}
          getCode={() => code}
          fileName={fileName}
        />
      </div>
      <div className={styles["artifacts-content"]}>
        {loading && <Loading />}
        {code && (
          <HTMLPreview
            code={code}
            ref={previewRef}
            autoHeight={false}
            height={"100%"}
            onLoad={(title) => {
              setFileName(title as string);
              setLoading(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
