using System;
using System.Reflection;
using System.ComponentModel;


namespace PC.Plugins.Common.Helper
{
    public class EnumerationHelper
    {
        public static string GetEnumDescription(Enum value)
        {
            FieldInfo fi = value.GetType().GetField(value.ToString());

            DescriptionAttribute[] attributes =
                (DescriptionAttribute[])fi.GetCustomAttributes(
                typeof(DescriptionAttribute),
                false);

            if (attributes != null &&
                attributes.Length > 0)
                return attributes[0].Description;
            else
                return value.ToString();
        }

        /// <summary>
        /// Funtion returning enum member based on its description
        /// </summary>
        /// <param name="enumDescription">Enum Description</param>
        public static T GetEnumFromDescription<T>(string enumDescription)
        {
            var enumType = typeof(T);
            if (!enumType.IsEnum) throw new InvalidOperationException();
            foreach (FieldInfo fieldInfo in enumType.GetFields())
            {
                DescriptionAttribute descriptionAttribute = Attribute.GetCustomAttribute(fieldInfo,
                    typeof(DescriptionAttribute)) as DescriptionAttribute;
                if (descriptionAttribute != null)
                {
                    if (descriptionAttribute.Description == enumDescription)
                        return (T)fieldInfo.GetValue(null);
                }
                else
                {
                    if (fieldInfo.Name == enumDescription)
                        return (T)fieldInfo.GetValue(null);
                }
            }
            throw new ArgumentException("Not found.", "description");
            // or return default(T);
        }
    }
}
