use crate::model::v1::platfrom::country::{Country, PlatformCountrySupport};
/// ไฟล์ platfrom.rs - Platform Enumeration และ Utilities
/// กำหนดประเภท platform ทั้งหมดที่ระบบรองรับ
/// ใช้ numeric ID สำหรับจัดเก็บใน database
/// รองรับการแปลงระหว่าง string และ enum
use serde::{Deserialize, Serialize};

/// Enumeration สำหรับ e-commerce platforms ที่รองรับ
/// ใช้ numeric ID สำหรับประสิทธิภาพในการจัดเก็บ
/// รองรับ serialization/deserialization
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Platform {
    TikTok,
    Shopee,
    Lazada,
    Shopify,
    WooCommerce,
    BigCommerce,
    Wix,
    Ecwid,
    Magento,
    Medusa,
    Zoho,
    LineShop,
    Taobao,
    JD,
    Walmart,
    Rakuten,
    Alibaba,
    AliExpress,
    Amazon,
    EBay,
    Etsy,
    Custom, // New custom platform support
}
impl Platform {
    /// แปลง Platform เป็น numeric ID สำหรับจัดเก็บใน database
    /// ใช้ u8 เพื่อประหยัดพื้นที่
    /// Returns: Platform ID (1-22)
    pub fn to_id(&self) -> u8 {
        match self {
            Platform::TikTok => 1,
            Platform::Shopee => 2,
            Platform::Lazada => 3,
            Platform::Shopify => 4,
            Platform::WooCommerce => 5,
            Platform::BigCommerce => 6,
            Platform::Wix => 7,
            Platform::Ecwid => 8,
            Platform::Magento => 9,
            Platform::Medusa => 10,
            Platform::Zoho => 11,
            Platform::LineShop => 12,
            Platform::Taobao => 13,
            Platform::JD => 14,
            Platform::Walmart => 15,
            Platform::Rakuten => 16,
            Platform::Alibaba => 17,
            Platform::AliExpress => 18,
            Platform::Amazon => 19,
            Platform::EBay => 20,
            Platform::Etsy => 21,
            Platform::Custom => 22,
        }
    }

    /// แปลง numeric ID กลับเป็น Platform enum
    /// ใช้สำหรับ query ข้อมูลจาก database
    /// Returns: Option<Platform> - None ถ้า ID ไม่ถูกต้อง
    pub fn from_id(id: u8) -> Option<Self> {
        match id {
            1 => Some(Platform::TikTok),
            2 => Some(Platform::Shopee),
            3 => Some(Platform::Lazada),
            4 => Some(Platform::Shopify),
            5 => Some(Platform::WooCommerce),
            6 => Some(Platform::BigCommerce),
            7 => Some(Platform::Wix),
            8 => Some(Platform::Ecwid),
            9 => Some(Platform::Magento),
            10 => Some(Platform::Medusa),
            11 => Some(Platform::Zoho),
            12 => Some(Platform::LineShop),
            13 => Some(Platform::Taobao),
            14 => Some(Platform::JD),
            15 => Some(Platform::Walmart),
            16 => Some(Platform::Rakuten),
            17 => Some(Platform::Alibaba),
            18 => Some(Platform::AliExpress),
            19 => Some(Platform::Amazon),
            20 => Some(Platform::EBay),
            21 => Some(Platform::Etsy),
            22 => Some(Platform::Custom),
            _ => None,
        }
    }
}

/// Implement Display trait สำหรับแปลงเป็น string
/// ใช้ lowercase สำหรับ consistency
/// ใช้ใน URL paths และ API responses
impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Platform::TikTok => "tiktok",
            Platform::Shopee => "shopee",
            Platform::Lazada => "lazada",
            Platform::Shopify => "shopify",
            Platform::WooCommerce => "woocommerce",
            Platform::BigCommerce => "bigcommerce",
            Platform::Wix => "wix",
            Platform::Ecwid => "ecwid",
            Platform::Magento => "magento",
            Platform::Medusa => "medusa",
            Platform::Zoho => "zoho",
            Platform::LineShop => "lineshop",
            Platform::Taobao => "taobao",
            Platform::JD => "jd",
            Platform::Walmart => "walmart",
            Platform::Rakuten => "rakuten",
            Platform::Alibaba => "alibaba",
            Platform::AliExpress => "aliexpress",
            Platform::Amazon => "amazon",
            Platform::EBay => "ebay",
            Platform::Etsy => "etsy",
            Platform::Custom => "custom",
        };
        write!(f, "{}", s)
    }
}

/// Implement FromStr trait สำหรับ parse จาก string
/// รองรับทั้ง lowercase และ variations (เช่น line_shop, lineshop)
/// Returns: Result<Platform> หรือ error message
impl std::str::FromStr for Platform {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "tiktok" => Ok(Platform::TikTok),
            "shopee" => Ok(Platform::Shopee),
            "lazada" => Ok(Platform::Lazada),
            "shopify" => Ok(Platform::Shopify),
            "woocommerce" => Ok(Platform::WooCommerce),
            "bigcommerce" => Ok(Platform::BigCommerce),
            "wix" => Ok(Platform::Wix),
            "ecwid" => Ok(Platform::Ecwid),
            "magento" => Ok(Platform::Magento),
            "medusa" => Ok(Platform::Medusa),
            "zoho" => Ok(Platform::Zoho),
            "lineshop" | "line_shop" | "lineshopping" | "line_shopping" | "line" => {
                Ok(Platform::LineShop)
            }
            "taobao" => Ok(Platform::Taobao),
            "jd" => Ok(Platform::JD),
            "walmart" => Ok(Platform::Walmart),
            "rakuten" => Ok(Platform::Rakuten),
            "alibaba" => Ok(Platform::Alibaba),
            "aliexpress" => Ok(Platform::AliExpress),
            "amazon" => Ok(Platform::Amazon),
            "ebay" => Ok(Platform::EBay),
            "etsy" => Ok(Platform::Etsy),
            "custom" => Ok(Platform::Custom),
            _ => Err(format!("Unknown platform: {}", s)),
        }
    }
}

/// Type alias สำหรับ Platform ID
/// ใช้ String สำหรับความยืดหยุ่นในการจัดเก็บ
pub type PlatformId = String;

impl Platform {
    /// Get supported countries for each platform
    pub fn supported_countries(&self) -> PlatformCountrySupport {
        match self {
            Platform::Lazada => {
                let mut support = PlatformCountrySupport::new(Country::Singapore);
                support.add_country(
                    Country::Vietnam,
                    Some("https://api.lazada.vn/rest".to_string()),
                );
                support.add_country(
                    Country::Singapore,
                    Some("https://api.lazada.sg/rest".to_string()),
                );
                support.add_country(
                    Country::Philippines,
                    Some("https://api.lazada.com.ph/rest".to_string()),
                );
                support.add_country(
                    Country::Malaysia,
                    Some("https://api.lazada.com.my/rest".to_string()),
                );
                support.add_country(
                    Country::Thailand,
                    Some("https://api.lazada.co.th/rest".to_string()),
                );
                support.add_country(
                    Country::Indonesia,
                    Some("https://api.lazada.co.id/rest".to_string()),
                );
                support
            }
            Platform::Shopee => {
                let mut support = PlatformCountrySupport::new(Country::Singapore);
                support.add_country(Country::Thailand, None);
                support.add_country(Country::Singapore, None);
                support.add_country(Country::Malaysia, None);
                support.add_country(Country::Indonesia, None);
                support.add_country(Country::Philippines, None);
                support.add_country(Country::Vietnam, None);
                support.add_country(Country::Brazil, None);
                support.add_country(Country::Mexico, None);
                support.add_country(Country::Colombia, None);
                support.add_country(Country::Chile, None);
                support.add_country(Country::Taiwan, None);
                support
            }
            Platform::TikTok => {
                let mut support = PlatformCountrySupport::new(Country::UnitedStates);
                support.add_country(Country::UnitedStates, None);
                support.add_country(Country::UnitedKingdom, None);
                support.add_country(Country::Indonesia, None);
                support.add_country(Country::Thailand, None);
                support.add_country(Country::Vietnam, None);
                support.add_country(Country::Malaysia, None);
                support.add_country(Country::Philippines, None);
                support.add_country(Country::Singapore, None);
                support
            }
            Platform::Amazon => {
                let mut support = PlatformCountrySupport::new(Country::UnitedStates);
                support.add_country(Country::UnitedStates, None);
                support.add_country(Country::Canada, None);
                support.add_country(Country::Mexico, None);
                support.add_country(Country::Brazil, None);
                support.add_country(Country::UnitedKingdom, None);
                support.add_country(Country::Germany, None);
                support.add_country(Country::France, None);
                support.add_country(Country::Italy, None);
                support.add_country(Country::Spain, None);
                support.add_country(Country::Netherlands, None);
                support.add_country(Country::Sweden, None);
                support.add_country(Country::Poland, None);
                support.add_country(Country::Turkey, None);
                support.add_country(Country::UnitedArabEmirates, None);
                support.add_country(Country::SaudiArabia, None);
                support.add_country(Country::Egypt, None);
                support.add_country(Country::India, None);
                support.add_country(Country::Japan, None);
                support.add_country(Country::Australia, None);
                support.add_country(Country::Singapore, None);
                support
            }
            Platform::Alibaba => {
                let mut support = PlatformCountrySupport::new(Country::China);
                support.add_country(Country::China, None);
                support.add_country(Country::Pakistan, Some("https://api.daraz.pk".to_string()));
                support.add_country(
                    Country::Bangladesh,
                    Some("https://api.daraz.com.bd".to_string()),
                );
                support.add_country(Country::SriLanka, Some("https://api.daraz.lk".to_string()));
                support.add_country(Country::Nepal, Some("https://api.daraz.com.np".to_string()));
                support.add_country(
                    Country::Myanmar,
                    Some("https://api.shop.com.mm".to_string()),
                );
                support.add_country(Country::Global, None);
                support
            }
            Platform::AliExpress => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                support.add_country(Country::SouthKorea, None);
                support.add_country(Country::Russia, None);
                support.add_country(Country::Brazil, None);
                support.add_country(Country::Spain, None);
                support.add_country(Country::France, None);
                support.add_country(Country::Poland, None);
                support.add_country(Country::Netherlands, None);
                support.add_country(Country::Turkey, None);
                support.add_country(Country::Italy, None);
                support.add_country(Country::Germany, None);
                support.add_country(Country::UnitedKingdom, None);
                support.add_country(Country::UnitedStates, None);
                support
            }
            Platform::EBay => {
                let mut support = PlatformCountrySupport::new(Country::UnitedStates);
                support.add_country(Country::Global, None);
                support.add_country(Country::UnitedStates, None);
                support.add_country(Country::UnitedKingdom, None);
                support.add_country(Country::Germany, None);
                support.add_country(Country::Australia, None);
                support.add_country(Country::Canada, None);
                support.add_country(Country::France, None);
                support.add_country(Country::Italy, None);
                support.add_country(Country::Spain, None);
                support.add_country(Country::Ireland, None);
                support.add_country(Country::Netherlands, None);
                support.add_country(Country::Belgium, None);
                support.add_country(Country::Austria, None);
                support.add_country(Country::Switzerland, None);
                support.add_country(Country::Poland, None);
                support
            }
            Platform::JD => {
                let mut support = PlatformCountrySupport::new(Country::China);
                support.add_country(Country::China, None);
                support.add_country(Country::Thailand, None);
                support.add_country(Country::Indonesia, None);
                support
            }
            Platform::Taobao => {
                let mut support = PlatformCountrySupport::new(Country::China);
                support.add_country(Country::China, None);
                support
            }
            Platform::Rakuten => {
                let mut support = PlatformCountrySupport::new(Country::Japan);
                support.add_country(Country::Japan, None);
                support
            }
            Platform::Walmart => {
                let mut support = PlatformCountrySupport::new(Country::UnitedStates);
                support.add_country(Country::UnitedStates, None);
                support.add_country(Country::Canada, None);
                support.add_country(Country::Mexico, None);
                support
            }
            Platform::Shopify => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // Shopify supports 175+ countries globally
                support
            }
            Platform::WooCommerce => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // WooCommerce is global by nature
                support
            }
            Platform::BigCommerce => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // BigCommerce supports global merchants
                support
            }
            Platform::Wix => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // Wix is available globally
                support
            }
            Platform::Ecwid => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // Ecwid supports global merchants
                support
            }
            Platform::Magento => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // Magento is global open-source
                support
            }
            Platform::Medusa => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                // Medusa is global headless commerce
                support
            }
            Platform::Zoho => {
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                support.add_country(Country::India, None);
                support.add_country(Country::UnitedStates, None);
                support.add_country(Country::Australia, None);
                support.add_country(Country::UnitedKingdom, None);
                support
            }
            Platform::LineShop => {
                let mut support = PlatformCountrySupport::new(Country::Japan);
                support.add_country(Country::Japan, None);
                support.add_country(Country::Thailand, None);
                support.add_country(Country::Taiwan, None);
                support
            }
            Platform::Etsy => {
                let mut support = PlatformCountrySupport::new(Country::UnitedStates);
                support.add_country(Country::Global, None);
                // Etsy is a global marketplace
                support
            }
            Platform::Custom => {
                // Custom platform supports all countries by default
                let mut support = PlatformCountrySupport::new(Country::Global);
                support.add_country(Country::Global, None);
                support
            }
        }
    }

    /// Check if platform supports a specific country
    pub fn supports_country(&self, country: &Country) -> bool {
        self.supported_countries().is_supported(country)
    }

    /// Get API endpoint for a specific country
    pub fn get_country_endpoint(&self, country: &Country) -> Option<String> {
        self.supported_countries().get_endpoint(country).cloned()
    }
}
