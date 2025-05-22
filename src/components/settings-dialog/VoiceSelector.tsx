import { useCallback, useEffect, useState } from "react";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";

const voiceOptions = [
  { value: "Puck", label: "Puck" },
  { value: "Charon", label: "Charon" },
  { value: "Kore", label: "Kore" },
  { value: "Fenrir", label: "Fenrir" },
  { value: "Aoede", label: "Aoede" },
  { value: "en-US-Neural2-A", label: "en-US-Neural2-A" },
  { value: "en-US-Neural2-B", label: "en-US-Neural2-B" },
  { value: "en-US-Neural2-C", label: "en-US-Neural2-C" },
  { value: "en-US-Neural2-D", label: "en-US-Neural2-D" },
  { value: "en-US-Neural2-E", label: "en-US-Neural2-E" },
  { value: "en-US-Neural2-F", label: "en-US-Neural2-F" },
];

export default function VoiceSelector() {
  const { config, setConfig, connected } = useLiveAPIContext();
  const [selectedOption, setSelectedOption] = useState(voiceOptions[0]);

  useEffect(() => {
    const voiceName =
      config.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig
        ?.voiceName || "Puck";
    const found = voiceOptions.find((v) => v.value === voiceName);
    setSelectedOption(found || voiceOptions[0]);
  }, [config]);

  const updateConfig = useCallback(
    (voiceName: string) => {
      setConfig({
        ...config,
        generationConfig: {
          ...config.generationConfig,
          speechConfig: {
            ...config.generationConfig?.speechConfig,
            voiceConfig: {
              ...config.generationConfig?.speechConfig?.voiceConfig,
              prebuiltVoiceConfig: {
                ...config.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig,
                voiceName,
              },
            },
          },
        },
      });
    },
    [config, setConfig]
  );

  return (
    <div className="select-group">
      <label htmlFor="voice-selector">Voice</label>
      <Select
        id="voice-selector"
        className="react-select"
        classNamePrefix="react-select"
        styles={{
          control: (baseStyles) => ({
            ...baseStyles,
            background: "var(--Neutral-15)",
            color: "var(--Neutral-90)",
            minHeight: "33px",
            maxHeight: "33px",
            border: 0,
          }),
          option: (styles, { isFocused, isSelected }) => ({
            ...styles,
            backgroundColor: isFocused
              ? "var(--Neutral-30)"
              : isSelected
              ? "var(--Neutral-20)"
              : undefined,
          }),
        }}
        value={selectedOption}
        defaultValue={selectedOption}
        options={voiceOptions}
        isDisabled={connected}
        onChange={(e) => {
          setSelectedOption(e!);
          if (e) {
            updateConfig(e.value);
          }
        }}
      />
    </div>
  );
}
