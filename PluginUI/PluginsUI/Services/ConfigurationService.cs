/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
using System.IO;
using System.Text.Json;
using PluginsUI.Models;

namespace PluginsUI.Services;

/// <summary>
/// Saves and loads <see cref="LreConfiguration"/> as a human-readable JSON file.
/// Passwords are never written to disk.
/// </summary>
public static class ConfigurationService
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        WriteIndented        = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>Serialise configuration to <paramref name="filePath"/>.</summary>
    public static void Save(LreConfiguration config, string filePath)
    {
        var json = JsonSerializer.Serialize(config, _opts);
        File.WriteAllText(filePath, json);
    }

    /// <summary>Deserialise configuration from <paramref name="filePath"/>.</summary>
    /// <returns>Loaded configuration, or a fresh default if the file is missing or corrupt.</returns>
    public static LreConfiguration Load(string filePath)
    {
        if (!File.Exists(filePath))
            return new LreConfiguration();

        try
        {
            var json = File.ReadAllText(filePath);
            return JsonSerializer.Deserialize<LreConfiguration>(json, _opts)
                   ?? new LreConfiguration();
        }
        catch (Exception ex) when (ex is IOException or System.Text.Json.JsonException or InvalidOperationException)
        {
            return new LreConfiguration();
        }
    }
}

