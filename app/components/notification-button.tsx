import React from "react";
import styles from "./notification-button.module.scss";
import { IconButton } from "./button";
import BellIcon from "../icons/bell.svg";
import { useNotifications } from "./notification";

export function NotificationButton(props: { 
  text?: string;
  className?: string;
}) {
  const {
    unreadCount,
    toggleModal,
  } = useNotifications();

  return (
    <div className={styles["notification-button"]}>
      <IconButton
        icon={<BellIcon />}
        text={props.text}
        className={props.className}
        onClick={toggleModal}
        shadow
      />
      {unreadCount > 0 && (
        <div className={styles["notification-badge"]}>
          {unreadCount}
        </div>
      )}
    </div>
  );
} 