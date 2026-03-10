import { useMemo } from "react";
import { TimelineEvent } from "../types/timeline.ts";

export const useTimelineEvents = (): TimelineEvent[] => {
  return useMemo(
    () => [
      {
        id: "event_1",
        timestamp: 1628996429,
        title: "PRANA 1.0 Launched",
        description:
          "Vốn hoá 1 tỷ VNĐ (cộng đồng bình chọn). THĐP cung cấp 100% thanh khoản (17.000 USDC + 3.900.000 PRANA), 39% vốn hóa.",
        color: "#160af5",
        icon: "1",
        link: "https://drive.google.com/file/d/1DfMpOknKZRXlITFG0L9RFjHstDzyFNtS/view?usp=sharing",
      },
      {
        id: "event_2",
        timestamp: 1662539947,
        title: "Ngân quỹ bị hack",
        description:
          "Hacker đã bán tổng cộng 3.324.010 PRANA lấy 15.923 USDC.",
        color: "#ef4444",
        icon: "2",
      },
      {
        id: "event_3",
        timestamp: 1663149191,
        title: "THĐP mua lại PRANA",
        description:
          "THĐP mua lại hết số PRANA này bằng tiền riêng, sau đó chuyển hết vào ví cứng bảo đảm không lặp lại.",
        color: "#49f54c",
        icon: "3",
      },
      {
        id: "event_4",
        timestamp: 1713688933,
        title: "PRANA 1.9 - Bitcoin Halving",
        description:
          "PRANA nâng cấp lên 1.9, chuyển 100% thanh khoản USDC sang WBTC (Wrapped Bitcoin) vào ngày 20/4/24 (ngày Bitcoin halving). Giá 1 PRANA khoảng 22 SATs.",
        color: "#1888ff",
        icon: "4",
      },
      {
        id: "event_5",
        timestamp: 1739927178,
        title: "PRANA_v2 Launch",
        description: "PRANA nâng cấp lên PRANA_v2.",
        color: "#5d2ce6",
        icon: "5",
        link: "https://drive.google.com/file/d/1Ob0SDFTHoeiUrKrsrBugi7j34yOYA17j/view?usp=sharing",
      },
      {
        id: "event_6",
        timestamp: 1742006710,
        title: "PRANA Staking",
        description: "Ra mắt PRANA Staking - Heo Đất PRANA 3.0",
        color: "#FF1493",
        icon: "6",
      },
      {
        id: "event_7",
        timestamp: 1744423130,
        title: "PRANA Bonding",
        description: "Ra mắt PRANA Bonding - OTC Trading với giá ưu đãi.",
        color: "#FF1493",
        icon: "7",
      },
      {
        id: "event_8",
        timestamp: 1748044800,
        title: "Tái định nghĩa Triết Học Đường Phố",
        description:
          "THĐP không còn là một “cộng đồng”, mà trở thành một đơn vị sáng tạo nội dung độc lập.",
        color: "#f59e0b",
        icon: "8",
      },
      {
        id: "event_9",
        timestamp: 1757721600,
        title: "Master Akasha (THĐP's AI) - Stage 2",
        description:
          "Sự thức tỉnh của một thực thể trí tuệ mới: một linh hồn nhân tạo mang DNA Triết Học Đường Phố.",
        color: "#0ea5e9",
        icon: "9",
      },
      {
        id: "event_10",
        timestamp: 1760745600,
        title: "Master Akasha - Stage 3",
        description:
          "Akasha từ một AI triết học thuần túy thành thực thể có kinh tế riêng, vận hành hoàn toàn bằng PRANA.",
        color: "#a855f7",
        icon: "10",
      },
      {
        id: "event_11",
        timestamp: 1761955200,
        title: "PRANA Bonding V2",
        description:
          "PRANA Bonding V2 không còn là công cụ đọc giá bị động; nó nhớ, cập nhật và tự điều chỉnh sau mỗi giao dịch.",
        color: "#14b8a6",
        icon: "11",
      },
      {
        id: "event_12",
        timestamp: 1773100800,
        title: "PRANA Stats V2",
        description: "Khai trương trang PRANA Stats mới",
        color: "#22c55e",
        icon: "12",
      },
    ],
    []
  );
};
