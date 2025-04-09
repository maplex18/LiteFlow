import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "./button";
import { Input } from "./ui-lib";
import { Path } from "../constant";
import styles from "./sme_register.module.scss";
import Image from "lite/image";

export function SMERegisterPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.registerPage}>
      <div className={styles["register-container"]}>
        <div className={styles["register-left"]}>
          <div className={styles["headline"]}>
            <h1>LeoPilot</h1>
            <p>註冊企業帳號，開始使用我們的服務</p>
          </div>
          <div className={styles["social-links"]}>
            <div className={styles["ai-services"]}>
              <Image
                src="/icons/claude-96.png"
                alt="Claude AI"
                width={40}
                height={40}
                className={styles["ai-icon"]}
              />
              <Image
                src="/icons/chatgpt.svg"
                alt="ChatGPT"
                width={40}
                height={40}
                className={styles["ai-icon"]}
              />
              <Image
                src="/icons/google-gemini.png"
                alt="Google Gemini"
                width={40}
                height={40}
                className={styles["ai-icon"]}
              />
            </div>
          </div>
        </div>

        <div className={styles["register-right"]}>
          <div className={styles["register-card"]}>
            <div className={styles["register-card-header"]}>
              <Image
                src="/icons/LeosysLogo.png"
                alt="Leosys Logo"
                width={100}
                height={100}
                priority
                className={styles["register-logo"]}
              />
              <h1>企業註冊</h1>
            </div>

            <form className={styles["register-form"]}>
              <div className={styles["form-group"]}>
                <div className={styles["form-field"]}>
                  <Input
                    className={styles["register-input"]}
                    placeholder="公司名稱"
                  />
                </div>
                <div className={styles["form-field"]}>
                  <Input
                    className={styles["register-input"]}
                    placeholder="公司統一編號"
                  />
                </div>
              </div>

              <div className={styles["form-group"]}>
                <div className={styles["form-field"]}>
                  <Input
                    className={styles["register-input"]}
                    placeholder="聯絡人"
                  />
                </div>
                <div className={styles["form-field"]}>
                  <Input
                    className={styles["register-input"]}
                    placeholder="聯絡電話"
                  />
                </div>
              </div>

              <Input
                type="email"
                className={styles["register-input"]}
                placeholder="電子郵件"
              />

              <div className={styles["form-group"]}>
                {/* <div className={styles["form-field"]}>
                  <Input
                    type="password"
                    className={styles["register-input"]}
                    placeholder="密碼"
                  />
                </div> */}
                {/* <div className={styles["form-field"]}>
                  <Input
                    type="password"
                    className={styles["register-input"]}
                    placeholder="確認密碼"
                  />
                </div> */}
              </div>



              <IconButton
                text="註冊"
                type="primary"
                onClick={() => {}}
                className={styles["register-button"]}
              />

              <div className={styles["login-link"]}>
                已有帳號？
                <a href="#" onClick={() => navigate(Path.Auth)}>
                  登入
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
