"use client";

import { Children, useState, type ReactNode } from "react";
import SeasonPicker, { type SeasonOption } from "./SeasonPicker";

export default function SeasonEpisodes({ seasons, children }: { seasons: SeasonOption[]; children: ReactNode }) {
  const [selected, setSelected] = useState(seasons[0]?.season_number);
  const panels = Children.toArray(children);
  if (!seasons.length) return <p className="py-10 text-center text-sm text-gray-400">Episodes will be uploaded soon. Stay tuned!</p>;
  const index = Math.max(0, seasons.findIndex(season => season.season_number === selected));
  return <div>
    <SeasonPicker seasons={seasons} value={seasons[index].season_number} onChange={setSelected} />
    {panels.map((panel, panelIndex) => <div key={seasons[panelIndex].id} hidden={panelIndex !== index}>{panel}</div>)}
  </div>;
}
