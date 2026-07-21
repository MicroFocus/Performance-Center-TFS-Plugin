/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
using System.IO;
using System.Text.Json;

namespace PluginsUI.Services;

/// <summary>
/// Saves and loads configuration objects as human-readable JSON files.
/// Passwords are never written to disk — the caller is responsible for omitting them.
/// </summary>
public static class ConfigurationService
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        WriteIndented        = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>Serialise <typeparamref name="T"/> to <paramref name="filePath"/>.</summary>
    public static void Save<T>(T config, string filePath)
    {
        var json = JsonSerializer.Serialize(config, _opts);
        File.WriteAllText(filePath, json);
    }

    /// <summary>
    /// Deserialise <typeparamref name="T"/> from <paramref name="filePath"/>.
    /// Returns a fresh default instance if the file is missing or corrupt.
    /// </summary>
    public static T Load<T>(string filePath) where T : new()
    {
        if (!File.Exists(filePath))
            return new T();

        try
        {
            var json = File.ReadAllText(filePath);
            return JsonSerializer.Deserialize<T>(json, _opts) ?? new T();
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException)
        {
            return new T();
        }
    }
}
