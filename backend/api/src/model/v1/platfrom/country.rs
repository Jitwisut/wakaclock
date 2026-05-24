use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Country/Region enumeration for all supported markets
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Country {
    // Asia Pacific
    #[serde(rename = "SG")]
    Singapore,
    #[serde(rename = "MY")]
    Malaysia,
    #[serde(rename = "TH")]
    Thailand,
    #[serde(rename = "ID")]
    Indonesia,
    #[serde(rename = "PH")]
    Philippines,
    #[serde(rename = "VN")]
    Vietnam,
    #[serde(rename = "CN")]
    China,
    #[serde(rename = "JP")]
    Japan,
    #[serde(rename = "KR")]
    SouthKorea,
    #[serde(rename = "IN")]
    India,
    #[serde(rename = "PK")]
    Pakistan,
    #[serde(rename = "BD")]
    Bangladesh,
    #[serde(rename = "LK")]
    SriLanka,
    #[serde(rename = "NP")]
    Nepal,
    #[serde(rename = "MM")]
    Myanmar,
    #[serde(rename = "HK")]
    HongKong,
    #[serde(rename = "TW")]
    Taiwan,

    // Americas
    #[serde(rename = "US")]
    UnitedStates,
    #[serde(rename = "CA")]
    Canada,
    #[serde(rename = "MX")]
    Mexico,
    #[serde(rename = "BR")]
    Brazil,
    #[serde(rename = "AR")]
    Argentina,
    #[serde(rename = "CL")]
    Chile,
    #[serde(rename = "CO")]
    Colombia,

    // Europe
    #[serde(rename = "GB")]
    UnitedKingdom,
    #[serde(rename = "DE")]
    Germany,
    #[serde(rename = "FR")]
    France,
    #[serde(rename = "IT")]
    Italy,
    #[serde(rename = "ES")]
    Spain,
    #[serde(rename = "NL")]
    Netherlands,
    #[serde(rename = "PL")]
    Poland,
    #[serde(rename = "SE")]
    Sweden,
    #[serde(rename = "IE")]
    Ireland,
    #[serde(rename = "BE")]
    Belgium,
    #[serde(rename = "AT")]
    Austria,
    #[serde(rename = "CH")]
    Switzerland,
    #[serde(rename = "PT")]
    Portugal,
    #[serde(rename = "DK")]
    Denmark,
    #[serde(rename = "NO")]
    Norway,
    #[serde(rename = "FI")]
    Finland,
    #[serde(rename = "GR")]
    Greece,
    #[serde(rename = "CZ")]
    CzechRepublic,
    #[serde(rename = "RO")]
    Romania,
    #[serde(rename = "HU")]
    Hungary,
    #[serde(rename = "RU")]
    Russia,
    #[serde(rename = "TR")]
    Turkey,

    // Middle East & Africa
    #[serde(rename = "AE")]
    UnitedArabEmirates,
    #[serde(rename = "SA")]
    SaudiArabia,
    #[serde(rename = "EG")]
    Egypt,
    #[serde(rename = "ZA")]
    SouthAfrica,
    #[serde(rename = "NG")]
    Nigeria,
    #[serde(rename = "KE")]
    Kenya,
    #[serde(rename = "IL")]
    Israel,

    // Oceania
    #[serde(rename = "AU")]
    Australia,
    #[serde(rename = "NZ")]
    NewZealand,

    // Global/All regions
    #[serde(rename = "GLOBAL")]
    Global,
}

impl Country {
    /// Get ISO 3166-1 alpha-2 country code
    pub fn code(&self) -> &'static str {
        match self {
            Country::Singapore => "SG",
            Country::Malaysia => "MY",
            Country::Thailand => "TH",
            Country::Indonesia => "ID",
            Country::Philippines => "PH",
            Country::Vietnam => "VN",
            Country::China => "CN",
            Country::Japan => "JP",
            Country::SouthKorea => "KR",
            Country::India => "IN",
            Country::Pakistan => "PK",
            Country::Bangladesh => "BD",
            Country::SriLanka => "LK",
            Country::Nepal => "NP",
            Country::Myanmar => "MM",
            Country::HongKong => "HK",
            Country::Taiwan => "TW",
            Country::UnitedStates => "US",
            Country::Canada => "CA",
            Country::Mexico => "MX",
            Country::Brazil => "BR",
            Country::Argentina => "AR",
            Country::Chile => "CL",
            Country::Colombia => "CO",
            Country::UnitedKingdom => "GB",
            Country::Germany => "DE",
            Country::France => "FR",
            Country::Italy => "IT",
            Country::Spain => "ES",
            Country::Netherlands => "NL",
            Country::Poland => "PL",
            Country::Sweden => "SE",
            Country::Ireland => "IE",
            Country::Belgium => "BE",
            Country::Austria => "AT",
            Country::Switzerland => "CH",
            Country::Portugal => "PT",
            Country::Denmark => "DK",
            Country::Norway => "NO",
            Country::Finland => "FI",
            Country::Greece => "GR",
            Country::CzechRepublic => "CZ",
            Country::Romania => "RO",
            Country::Hungary => "HU",
            Country::Russia => "RU",
            Country::Turkey => "TR",
            Country::UnitedArabEmirates => "AE",
            Country::SaudiArabia => "SA",
            Country::Egypt => "EG",
            Country::SouthAfrica => "ZA",
            Country::Nigeria => "NG",
            Country::Kenya => "KE",
            Country::Israel => "IL",
            Country::Australia => "AU",
            Country::NewZealand => "NZ",
            Country::Global => "GLOBAL",
        }
    }

    /// Get country name
    pub fn name(&self) -> &'static str {
        match self {
            Country::Singapore => "Singapore",
            Country::Malaysia => "Malaysia",
            Country::Thailand => "Thailand",
            Country::Indonesia => "Indonesia",
            Country::Philippines => "Philippines",
            Country::Vietnam => "Vietnam",
            Country::China => "China",
            Country::Japan => "Japan",
            Country::SouthKorea => "South Korea",
            Country::India => "India",
            Country::Pakistan => "Pakistan",
            Country::Bangladesh => "Bangladesh",
            Country::SriLanka => "Sri Lanka",
            Country::Nepal => "Nepal",
            Country::Myanmar => "Myanmar",
            Country::HongKong => "Hong Kong",
            Country::Taiwan => "Taiwan",
            Country::UnitedStates => "United States",
            Country::Canada => "Canada",
            Country::Mexico => "Mexico",
            Country::Brazil => "Brazil",
            Country::Argentina => "Argentina",
            Country::Chile => "Chile",
            Country::Colombia => "Colombia",
            Country::UnitedKingdom => "United Kingdom",
            Country::Germany => "Germany",
            Country::France => "France",
            Country::Italy => "Italy",
            Country::Spain => "Spain",
            Country::Netherlands => "Netherlands",
            Country::Poland => "Poland",
            Country::Sweden => "Sweden",
            Country::Ireland => "Ireland",
            Country::Belgium => "Belgium",
            Country::Austria => "Austria",
            Country::Switzerland => "Switzerland",
            Country::Portugal => "Portugal",
            Country::Denmark => "Denmark",
            Country::Norway => "Norway",
            Country::Finland => "Finland",
            Country::Greece => "Greece",
            Country::CzechRepublic => "Czech Republic",
            Country::Romania => "Romania",
            Country::Hungary => "Hungary",
            Country::Russia => "Russia",
            Country::Turkey => "Turkey",
            Country::UnitedArabEmirates => "United Arab Emirates",
            Country::SaudiArabia => "Saudi Arabia",
            Country::Egypt => "Egypt",
            Country::SouthAfrica => "South Africa",
            Country::Nigeria => "Nigeria",
            Country::Kenya => "Kenya",
            Country::Israel => "Israel",
            Country::Australia => "Australia",
            Country::NewZealand => "New Zealand",
            Country::Global => "Global",
        }
    }

    /// Get default currency for the country
    pub fn default_currency(&self) -> &'static str {
        match self {
            Country::Singapore => "SGD",
            Country::Malaysia => "MYR",
            Country::Thailand => "THB",
            Country::Indonesia => "IDR",
            Country::Philippines => "PHP",
            Country::Vietnam => "VND",
            Country::China => "CNY",
            Country::Japan => "JPY",
            Country::SouthKorea => "KRW",
            Country::India => "INR",
            Country::Pakistan => "PKR",
            Country::Bangladesh => "BDT",
            Country::SriLanka => "LKR",
            Country::Nepal => "NPR",
            Country::Myanmar => "MMK",
            Country::HongKong => "HKD",
            Country::Taiwan => "TWD",
            Country::UnitedStates => "USD",
            Country::Canada => "CAD",
            Country::Mexico => "MXN",
            Country::Brazil => "BRL",
            Country::Argentina => "ARS",
            Country::Chile => "CLP",
            Country::Colombia => "COP",
            Country::UnitedKingdom => "GBP",
            Country::Germany
            | Country::France
            | Country::Italy
            | Country::Spain
            | Country::Netherlands
            | Country::Belgium
            | Country::Austria
            | Country::Portugal
            | Country::Ireland
            | Country::Finland
            | Country::Greece => "EUR",
            Country::Poland => "PLN",
            Country::Sweden => "SEK",
            Country::Switzerland => "CHF",
            Country::Denmark => "DKK",
            Country::Norway => "NOK",
            Country::CzechRepublic => "CZK",
            Country::Romania => "RON",
            Country::Hungary => "HUF",
            Country::Russia => "RUB",
            Country::Turkey => "TRY",
            Country::UnitedArabEmirates => "AED",
            Country::SaudiArabia => "SAR",
            Country::Egypt => "EGP",
            Country::SouthAfrica => "ZAR",
            Country::Nigeria => "NGN",
            Country::Kenya => "KES",
            Country::Israel => "ILS",
            Country::Australia => "AUD",
            Country::NewZealand => "NZD",
            Country::Global => "USD",
        }
    }

    /// Parse country from string code
    pub fn from_code(code: &str) -> Option<Self> {
        match code.to_uppercase().as_str() {
            "SG" => Some(Country::Singapore),
            "MY" => Some(Country::Malaysia),
            "TH" => Some(Country::Thailand),
            "ID" => Some(Country::Indonesia),
            "PH" => Some(Country::Philippines),
            "VN" => Some(Country::Vietnam),
            "CN" => Some(Country::China),
            "JP" => Some(Country::Japan),
            "KR" => Some(Country::SouthKorea),
            "IN" => Some(Country::India),
            "PK" => Some(Country::Pakistan),
            "BD" => Some(Country::Bangladesh),
            "LK" => Some(Country::SriLanka),
            "NP" => Some(Country::Nepal),
            "MM" => Some(Country::Myanmar),
            "HK" => Some(Country::HongKong),
            "TW" => Some(Country::Taiwan),
            "US" => Some(Country::UnitedStates),
            "CA" => Some(Country::Canada),
            "MX" => Some(Country::Mexico),
            "BR" => Some(Country::Brazil),
            "AR" => Some(Country::Argentina),
            "CL" => Some(Country::Chile),
            "CO" => Some(Country::Colombia),
            "GB" | "UK" => Some(Country::UnitedKingdom),
            "DE" => Some(Country::Germany),
            "FR" => Some(Country::France),
            "IT" => Some(Country::Italy),
            "ES" => Some(Country::Spain),
            "NL" => Some(Country::Netherlands),
            "PL" => Some(Country::Poland),
            "SE" => Some(Country::Sweden),
            "IE" => Some(Country::Ireland),
            "BE" => Some(Country::Belgium),
            "AT" => Some(Country::Austria),
            "CH" => Some(Country::Switzerland),
            "PT" => Some(Country::Portugal),
            "DK" => Some(Country::Denmark),
            "NO" => Some(Country::Norway),
            "FI" => Some(Country::Finland),
            "GR" => Some(Country::Greece),
            "CZ" => Some(Country::CzechRepublic),
            "RO" => Some(Country::Romania),
            "HU" => Some(Country::Hungary),
            "RU" => Some(Country::Russia),
            "TR" => Some(Country::Turkey),
            "AE" => Some(Country::UnitedArabEmirates),
            "SA" => Some(Country::SaudiArabia),
            "EG" => Some(Country::Egypt),
            "ZA" => Some(Country::SouthAfrica),
            "NG" => Some(Country::Nigeria),
            "KE" => Some(Country::Kenya),
            "IL" => Some(Country::Israel),
            "AU" => Some(Country::Australia),
            "NZ" => Some(Country::NewZealand),
            "GLOBAL" | "*" => Some(Country::Global),
            _ => None,
        }
    }
}

impl std::fmt::Display for Country {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.code())
    }
}

impl std::str::FromStr for Country {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Country::from_code(s).ok_or_else(|| format!("Unknown country code: {}", s))
    }
}

/// Platform country support configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCountrySupport {
    pub supported_countries: Vec<Country>,
    pub default_country: Country,
    pub api_endpoints: HashMap<Country, String>,
}

impl PlatformCountrySupport {
    /// Create new platform country support configuration
    pub fn new(default_country: Country) -> Self {
        Self {
            supported_countries: vec![default_country],
            default_country,
            api_endpoints: HashMap::new(),
        }
    }

    /// Add supported country with optional API endpoint
    pub fn add_country(&mut self, country: Country, api_endpoint: Option<String>) {
        if !self.supported_countries.contains(&country) {
            self.supported_countries.push(country);
        }
        if let Some(endpoint) = api_endpoint {
            self.api_endpoints.insert(country, endpoint);
        }
    }

    /// Check if country is supported
    pub fn is_supported(&self, country: &Country) -> bool {
        self.supported_countries.contains(country) || *country == Country::Global
    }

    /// Get API endpoint for country
    pub fn get_endpoint(&self, country: &Country) -> Option<&String> {
        self.api_endpoints.get(country)
    }
}
