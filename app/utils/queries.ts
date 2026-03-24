export const SHOP_AUDIT_QUERY = `#graphql
  query ShopAuditData {
    shop {
      name
      email
      myshopifyDomain
      primaryDomain {
        url
        host
      }
    }

    products(first: 50) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
          metafields(first: 10) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
      }
    }

    collections(first: 20) {
      edges {
        node {
          title
          handle
          description
        }
      }
    }

    pages: onlineStorePublishedContentEagerlyOnboard: pages(first: 30) {
      edges {
        node {
          title
          handle
          bodySummary
        }
      }
    }

    themes(first: 5) {
      edges {
        node {
          name
          role
        }
      }
    }
  }
`;

// Simplified valid query
export const SHOP_DATA_QUERY = `#graphql
  query GetShopData {
    shop {
      name
      email
      myshopifyDomain
      primaryDomain {
        url
        host
      }
    }
    products(first: 50) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
          metafields(first: 5, namespace: "custom") {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
      }
    }
    collections(first: 20) {
      edges {
        node {
          title
          handle
          description
        }
      }
    }
  }
`;

export const PAGES_QUERY = `#graphql
  query GetPages {
    pages(first: 30) {
      edges {
        node {
          title
          handle
          bodySummary
        }
      }
    }
  }
`;
