import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seedJewelryData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "eur",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system"
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Lilianna Jewelry Atelier",
          address: {
            city: "New York",
            country_code: "US",
            address_1: "123 Diamond Street",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default"
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Jewelry Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "gb",
            type: "country",
          },
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Secure Jewelry Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Secure",
          description: "Insured shipping for jewelry (3-5 business days)",
          code: "secure",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 1500,
          },
          {
            currency_code: "eur",
            amount: 1200,
          },
          {
            region_id: region.id,
            amount: 1200,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Jewelry Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Express insured delivery (1-2 business days)",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 2500,
          },
          {
            currency_code: "eur",
            amount: 2000,
          },
          {
            region_id: region.id,
            amount: 2000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Lilianna Jewelry Storefront",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  // Create jewelry categories
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Necklaces",
          description: "Beautiful necklaces for every occasion",
          is_active: true,
        },
        {
          name: "Earrings",
          description: "Elegant earrings to complete your look",
          is_active: true,
        },
        {
          name: "Rings",
          description: "Stunning rings for special moments",
          is_active: true,
        },
        {
          name: "Bracelets",
          description: "Delicate bracelets and bangles",
          is_active: true,
        },
        {
          name: "Brooches",
          description: "Vintage-inspired brooches and pins",
          is_active: true,
        },
        {
          name: "Wedding Collection",
          description: "Special pieces for your wedding day",
          is_active: true,
        },
      ],
    },
  });

  // Create jewelry products
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elegant Pearl Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "A stunning pearl necklace featuring lustrous freshwater pearls. Perfect for elegant occasions and everyday wear.",
          handle: "elegant-pearl-necklace",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Length",
              values: ["16 inches", "18 inches", "20 inches"],
            },
            {
              title: "Metal",
              values: ["Silver", "Gold"],
            },
          ],
          variants: [
            {
              title: "16 inches / Silver",
              sku: "PEARL-NECKLACE-16-SILVER",
              options: {
                Length: "16 inches",
                Metal: "Silver",
              },
              prices: [
                {
                  amount: 12000,
                  currency_code: "eur",
                },
                {
                  amount: 13000,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "18 inches / Gold",
              sku: "PEARL-NECKLACE-18-GOLD",
              options: {
                Length: "18 inches",
                Metal: "Gold",
              },
              prices: [
                {
                  amount: 15000,
                  currency_code: "eur",
                },
                {
                  amount: 16000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Diamond Stud Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Classic diamond stud earrings featuring brilliant cut diamonds. Timeless elegance for any occasion.",
          handle: "diamond-stud-earrings",
          weight: 10,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["0.5 carat", "1 carat", "1.5 carat"],
            },
            {
              title: "Metal",
              values: ["White Gold", "Yellow Gold", "Rose Gold"],
            },
          ],
          variants: [
            {
              title: "0.5 carat / White Gold",
              sku: "DIAMOND-STUD-05-WHITE",
              options: {
                Size: "0.5 carat",
                Metal: "White Gold",
              },
              prices: [
                {
                  amount: 80000,
                  currency_code: "eur",
                },
                {
                  amount: 85000,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "1 carat / Yellow Gold",
              sku: "DIAMOND-STUD-1-YELLOW",
              options: {
                Size: "1 carat",
                Metal: "Yellow Gold",
              },
              prices: [
                {
                  amount: 150000,
                  currency_code: "eur",
                },
                {
                  amount: 160000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Vintage Rose Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "A beautiful vintage-inspired rose ring with intricate details. Perfect for engagements or special occasions.",
          handle: "vintage-rose-ring",
          weight: 15,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["5", "6", "7", "8", "9"],
            },
            {
              title: "Metal",
              values: ["Rose Gold", "White Gold", "Yellow Gold"],
            },
          ],
          variants: [
            {
              title: "Size 7 / Rose Gold",
              sku: "VINTAGE-ROSE-7-ROSE",
              options: {
                Size: "7",
                Metal: "Rose Gold",
              },
              prices: [
                {
                  amount: 25000,
                  currency_code: "eur",
                },
                {
                  amount: 27000,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Size 6 / White Gold",
              sku: "VINTAGE-ROSE-6-WHITE",
              options: {
                Size: "6",
                Metal: "White Gold",
              },
              prices: [
                {
                  amount: 23000,
                  currency_code: "eur",
                },
                {
                  amount: 25000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Delicate Chain Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "A delicate chain bracelet that adds a touch of elegance to any outfit. Perfect for layering or wearing alone.",
          handle: "delicate-chain-bracelet",
          weight: 8,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Length",
              values: ["7 inches", "8 inches"],
            },
            {
              title: "Metal",
              values: ["Silver", "Gold", "Rose Gold"],
            },
          ],
          variants: [
            {
              title: "7 inches / Silver",
              sku: "CHAIN-BRACELET-7-SILVER",
              options: {
                Length: "7 inches",
                Metal: "Silver",
              },
              prices: [
                {
                  amount: 8000,
                  currency_code: "eur",
                },
                {
                  amount: 9000,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "8 inches / Gold",
              sku: "CHAIN-BRACELET-8-GOLD",
              options: {
                Length: "8 inches",
                Metal: "Gold",
              },
              prices: [
                {
                  amount: 12000,
                  currency_code: "eur",
                },
                {
                  amount: 13000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Sapphire Teardrop Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "An exquisite sapphire teardrop pendant suspended from a delicate gold chain. The deep blue sapphire captures light beautifully, creating a stunning focal point for any elegant occasion.",
          handle: "sapphire-teardrop-necklace",
          weight: 45,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Chain Length",
              values: ["16 inches", "18 inches", "20 inches"],
            },
            {
              title: "Metal",
              values: ["White Gold", "Yellow Gold"],
            },
          ],
          variants: [
            {
              title: "18 inches / White Gold",
              sku: "SAPPHIRE-TEARDROP-18-WHITE",
              options: {
                "Chain Length": "18 inches",
                Metal: "White Gold",
              },
              prices: [
                {
                  amount: 28000,
                  currency_code: "eur",
                },
                {
                  amount: 30000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Gold Hoop Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Classic gold hoop earrings that never go out of style. Crafted from high-quality gold with a smooth, polished finish. Perfect for both casual and formal occasions.",
          handle: "gold-hoop-earrings",
          weight: 12,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Small (20mm)", "Medium (30mm)", "Large (40mm)"],
            },
            {
              title: "Metal",
              values: ["14K Gold", "18K Gold"],
            },
          ],
          variants: [
            {
              title: "Medium (30mm) / 14K Gold",
              sku: "GOLD-HOOP-MEDIUM-14K",
              options: {
                Size: "Medium (30mm)",
                Metal: "14K Gold",
              },
              prices: [
                {
                  amount: 18000,
                  currency_code: "eur",
                },
                {
                  amount: 19500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Emerald Engagement Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Wedding Collection")!.id,
          ],
          description:
            "A breathtaking emerald engagement ring featuring a stunning emerald-cut emerald surrounded by brilliant diamonds. This timeless piece represents eternal love and commitment.",
          handle: "emerald-engagement-ring",
          weight: 18,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Ring Size",
              values: ["5", "5.5", "6", "6.5", "7", "7.5", "8"],
            },
            {
              title: "Metal",
              values: ["Platinum", "White Gold", "Yellow Gold"],
            },
          ],
          variants: [
            {
              title: "Size 6.5 / Platinum",
              sku: "EMERALD-ENGAGEMENT-65-PLATINUM",
              options: {
                "Ring Size": "6.5",
                Metal: "Platinum",
              },
              prices: [
                {
                  amount: 450000,
                  currency_code: "eur",
                },
                {
                  amount: 480000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Tennis Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "A classic tennis bracelet featuring a continuous line of brilliant diamonds. This timeless piece adds sparkle and sophistication to any outfit, perfect for special occasions.",
          handle: "tennis-bracelet",
          weight: 25,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Length",
              values: ["6.5 inches", "7 inches", "7.5 inches"],
            },
            {
              title: "Metal",
              values: ["White Gold", "Yellow Gold", "Platinum"],
            },
          ],
          variants: [
            {
              title: "7 inches / White Gold",
              sku: "TENNIS-BRACELET-7-WHITE",
              options: {
                Length: "7 inches",
                Metal: "White Gold",
              },
              prices: [
                {
                  amount: 320000,
                  currency_code: "eur",
                },
                {
                  amount: 340000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Vintage Cameo Brooch",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brooches")!.id,
          ],
          description:
            "An elegant vintage-inspired cameo brooch featuring intricate carved details. This timeless piece adds a touch of classic sophistication to jackets, scarves, or dresses.",
          handle: "vintage-cameo-brooch",
          weight: 15,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1653888779387-84635fcfd330?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Small (25mm)", "Medium (35mm)", "Large (45mm)"],
            },
            {
              title: "Metal",
              values: ["Sterling Silver", "Gold Plated"],
            },
          ],
          variants: [
            {
              title: "Medium (35mm) / Sterling Silver",
              sku: "CAMEO-BROOCH-MEDIUM-SILVER",
              options: {
                Size: "Medium (35mm)",
                Metal: "Sterling Silver",
              },
              prices: [
                {
                  amount: 15000,
                  currency_code: "eur",
                },
                {
                  amount: 16500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Ruby Heart Pendant",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "A romantic ruby heart pendant that symbolizes love and passion. The deep red ruby is beautifully set in a delicate heart-shaped setting, perfect for expressing your feelings.",
          handle: "ruby-heart-pendant",
          weight: 35,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Chain Length",
              values: ["16 inches", "18 inches"],
            },
            {
              title: "Metal",
              values: ["Rose Gold", "White Gold"],
            },
          ],
          variants: [
            {
              title: "18 inches / Rose Gold",
              sku: "RUBY-HEART-18-ROSE",
              options: {
                "Chain Length": "18 inches",
                Metal: "Rose Gold",
              },
              prices: [
                {
                  amount: 22000,
                  currency_code: "eur",
                },
                {
                  amount: 24000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Infinity Band Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "An elegant infinity band ring symbolizing eternal love and endless possibilities. Features a continuous infinity pattern adorned with small diamonds.",
          handle: "infinity-band-ring",
          weight: 10,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["5", "6", "7", "8", "9"],
            },
            {
              title: "Metal",
              values: ["Sterling Silver", "White Gold", "Rose Gold"],
            },
          ],
          variants: [
            {
              title: "Size 7 / White Gold",
              sku: "INFINITY-BAND-7-WHITE",
              options: {
                Size: "7",
                Metal: "White Gold",
              },
              prices: [
                {
                  amount: 16000,
                  currency_code: "eur",
                },
                {
                  amount: 17500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Chandelier Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Stunning chandelier earrings that make a bold statement. Features cascading crystals and intricate metalwork that catches the light beautifully.",
          handle: "chandelier-earrings",
          weight: 20,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Style",
              values: ["Crystal", "Pearl", "Mixed"],
            },
            {
              title: "Metal",
              values: ["Silver", "Gold", "Rose Gold"],
            },
          ],
          variants: [
            {
              title: "Crystal / Silver",
              sku: "CHANDELIER-CRYSTAL-SILVER",
              options: {
                Style: "Crystal",
                Metal: "Silver",
              },
              prices: [
                {
                  amount: 24000,
                  currency_code: "eur",
                },
                {
                  amount: 26000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Stackable Ring Set",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "A beautiful set of three stackable rings that can be worn together or separately. Each ring features a different texture and style for a unique layered look.",
          handle: "stackable-ring-set",
          weight: 12,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["5", "6", "7", "8"],
            },
            {
              title: "Metal",
              values: ["Mixed Metals", "All Gold", "All Silver"],
            },
          ],
          variants: [
            {
              title: "Size 6 / Mixed Metals",
              sku: "STACKABLE-SET-6-MIXED",
              options: {
                Size: "6",
                Metal: "Mixed Metals",
              },
              prices: [
                {
                  amount: 18000,
                  currency_code: "eur",
                },
                {
                  amount: 19500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Charm Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "A personalized charm bracelet that tells your story. Comes with initial starter charms and room to add more meaningful charms over time.",
          handle: "charm-bracelet",
          weight: 30,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Length",
              values: ["7 inches", "8 inches"],
            },
            {
              title: "Metal",
              values: ["Sterling Silver", "Gold Plated"],
            },
          ],
          variants: [
            {
              title: "7.5 inches / Sterling Silver",
              sku: "CHARM-BRACELET-75-SILVER",
              options: {
                Length: "7 inches",
                Metal: "Sterling Silver",
              },
              prices: [
                {
                  amount: 14000,
                  currency_code: "eur",
                },
                {
                  amount: 15500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Art Deco Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "A stunning Art Deco inspired necklace featuring geometric patterns and vintage elegance. This statement piece captures the glamour of the 1920s.",
          handle: "art-deco-necklace",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Length",
              values: ["16 inches", "18 inches"],
            },
            {
              title: "Metal",
              values: ["Silver", "Gold"],
            },
          ],
          variants: [
            {
              title: "16 inches / Silver",
              sku: "ART-DECO-16-SILVER",
              options: {
                Length: "16 inches",
                Metal: "Silver",
              },
              prices: [
                {
                  amount: 35000,
                  currency_code: "eur",
                },
                {
                  amount: 38000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Moonstone Earrings",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Earrings")!.id,
          ],
          description:
            "Ethereal moonstone earrings that capture the mystery of moonlight. The iridescent stones shimmer with blue and white flashes, creating a magical effect.",
          handle: "moonstone-earrings",
          weight: 8,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Style",
              values: ["Drop", "Stud"],
            },
            {
              title: "Metal",
              values: ["Sterling Silver", "Rose Gold"],
            },
          ],
          variants: [
            {
              title: "Drop / Sterling Silver",
              sku: "MOONSTONE-DROP-SILVER",
              options: {
                Style: "Drop",
                Metal: "Sterling Silver",
              },
              prices: [
                {
                  amount: 12000,
                  currency_code: "eur",
                },
                {
                  amount: 13500,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Wedding Band Set",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Wedding Collection")!.id,
          ],
          description:
            "A beautiful matching wedding band set for couples. Crafted with precision and care, these bands symbolize your eternal commitment to each other.",
          handle: "wedding-band-set",
          weight: 20,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "His Size",
              values: ["8", "9", "10", "11", "12"],
            },
            {
              title: "Her Size",
              values: ["5", "6", "7", "8"],
            },
            {
              title: "Metal",
              values: ["Platinum", "White Gold", "Yellow Gold"],
            },
          ],
          variants: [
            {
              title: "His 10 / Her 6 / Platinum",
              sku: "WEDDING-SET-10-6-PLATINUM",
              options: {
                "His Size": "10",
                "Her Size": "6",
                Metal: "Platinum",
              },
              prices: [
                {
                  amount: 180000,
                  currency_code: "eur",
                },
                {
                  amount: 195000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Turquoise Statement Ring",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rings")!.id,
          ],
          description:
            "A bold turquoise statement ring that adds a pop of color to any outfit. The vibrant blue-green stone is beautifully set in an ornate silver setting.",
          handle: "turquoise-statement-ring",
          weight: 22,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["5", "6", "7", "8", "9"],
            },
            {
              title: "Stone Shape",
              values: ["Oval", "Round", "Teardrop"],
            },
          ],
          variants: [
            {
              title: "Size 7 / Oval",
              sku: "TURQUOISE-STATEMENT-7-OVAL",
              options: {
                Size: "7",
                "Stone Shape": "Oval",
              },
              prices: [
                {
                  amount: 19000,
                  currency_code: "eur",
                },
                {
                  amount: 21000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Layered Gold Necklace",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Necklaces")!.id,
          ],
          description:
            "A trendy layered gold necklace set featuring three different chain lengths and styles. Perfect for creating a modern, layered look effortlessly.",
          handle: "layered-gold-necklace",
          weight: 25,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Metal",
              values: ["14K Gold", "18K Gold", "Gold Filled"],
            },
            {
              title: "Style",
              values: ["Minimalist", "With Charms"],
            },
          ],
          variants: [
            {
              title: "14K Gold / Minimalist",
              sku: "LAYERED-GOLD-14K-MINIMAL",
              options: {
                Metal: "14K Gold",
                Style: "Minimalist",
              },
              prices: [
                {
                  amount: 32000,
                  currency_code: "eur",
                },
                {
                  amount: 35000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Vintage Brooch Collection",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Brooches")!.id,
          ],
          description:
            "A curated collection of vintage-inspired brooches featuring butterflies, flowers, and geometric designs. Each piece tells a story of timeless elegance.",
          handle: "vintage-brooch-collection",
          weight: 18,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1586115180241-b3e4f01ed837?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Design",
              values: ["Butterfly", "Flower", "Geometric"],
            },
            {
              title: "Metal",
              values: ["Antique Silver", "Antique Gold"],
            },
          ],
          variants: [
            {
              title: "Butterfly / Antique Silver",
              sku: "VINTAGE-BROOCH-BUTTERFLY-SILVER",
              options: {
                Design: "Butterfly",
                Metal: "Antique Silver",
              },
              prices: [
                {
                  amount: 22000,
                  currency_code: "eur",
                },
                {
                  amount: 24000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Amethyst Cluster Bracelet",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Bracelets")!.id,
          ],
          description:
            "A stunning amethyst cluster bracelet featuring natural amethyst stones in various shades of purple. Each stone is unique, making this piece truly one-of-a-kind.",
          handle: "amethyst-cluster-bracelet",
          weight: 35,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=500&h=500&fit=crop",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Small (6.5 inches)", "Medium (7 inches)", "Large (7.5 inches)"],
            },
            {
              title: "Stone Grade",
              values: ["A Grade", "AA Grade", "AAA Grade"],
            },
          ],
          variants: [
            {
              title: "Medium (7 inches) / AA Grade",
              sku: "AMETHYST-CLUSTER-MEDIUM-AA",
              options: {
                Size: "Medium (7 inches)",
                "Stone Grade": "AA Grade",
              },
              prices: [
                {
                  amount: 26000,
                  currency_code: "eur",
                },
                {
                  amount: 28000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  logger.info("Finished seeding jewelry product data.");

  // Set up inventory levels
  logger.info("Seeding jewelry inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 50, // Lower quantities for jewelry
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding jewelry inventory levels data.");
}