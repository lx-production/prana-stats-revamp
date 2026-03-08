import { useMemo } from "react";
import { TimelineEvent } from "../types/timeline";

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
        icon: "➊",
        link: "https://drive.google.com/file/d/1DfMpOknKZRXlITFG0L9RFjHstDzyFNtS/view?usp=sharing",
      },
      {
        id: "event_2",
        timestamp: 1662539947,
        title: "Ngân quỹ bị hack",
        description:
          "Hacker đã bán tổng cộng 3.324.010 PRANA lấy 15.923 USDC.",
        color: "#ef4444",
        icon: "➋",
      },
      {
        id: "event_3",
        timestamp: 1663149191,
        title: "THĐP mua lại PRANA",
        description:
          "THĐP mua lại hết số PRANA này bằng tiền riêng, sau đó chuyển hết vào ví cứng bảo đảm không lặp lại.",
        color: "#49f54c",
        icon: "➌",
      },
      {
        id: "event_4",
        timestamp: 1713688933,
        title: "PRANA 1.9 - Bitcoin Halving",
        description:
          "PRANA nâng cấp lên 1.9, chuyển 100% thanh khoản USDC sang WBTC (Wrapped Bitcoin) vào ngày 20/4/24 (ngày Bitcoin halving). Giá 1 PRANA khoảng 22 SATs.",
        color: "#1888ff",
        icon: "➍",
      },
      {
        id: "event_5",
        timestamp: 1739927178,
        title: "PRANA_v2 Launch",
        description: "PRANA nâng cấp lên PRANA_v2.",
        color: "#5d2ce6",
        icon: "➎",
        link: "https://drive.google.com/file/d/1Ob0SDFTHoeiUrKrsrBugi7j34yOYA17j/view?usp=sharing",
      },
      {
        id: "event_6",
        timestamp: 1742006710,
        title: "PRANA Staking 3.0",
        description: "Ra mắt PRANA Staking - Heo Đất PRANA 3.0",
        color: "#FF1493",
        icon: "➏",
      },
      {
        id: "event_7",
        timestamp: 1744423130,
        title: "PRANA Bonding",
        description: "Ra mắt PRANA Bonding - OTC Trading với giá ưu đãi.",
        color: "#FF1493",
        icon: "➐",
      },
    ],
    []
  );
};
