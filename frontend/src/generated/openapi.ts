/* Generated from FastAPI by backend/scripts/export_openapi.py. */
export const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "knut-vandrar API",
    "version": "0.1.0"
  },
  "paths": {
    "/api/hikes": {
      "get": {
        "tags": [
          "hikes"
        ],
        "summary": "List Hikes",
        "operationId": "list_hikes_api_hikes_get",
        "parameters": [
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 100,
              "minimum": 1,
              "description": "Maximum entries to return",
              "default": 10,
              "title": "Limit"
            },
            "description": "Maximum entries to return"
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "description": "Number of entries to skip",
              "default": 0,
              "title": "Offset"
            },
            "description": "Number of entries to skip"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Page_HikeSummaryRead_"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "hikes"
        ],
        "summary": "Create Hike",
        "operationId": "create_hike_api_hikes_post",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HikeWrite"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/hikes/{hike_id}": {
      "get": {
        "tags": [
          "hikes"
        ],
        "summary": "Get Hike",
        "operationId": "get_hike_api_hikes__hike_id__get",
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          },
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeRead"
                }
              }
            }
          },
          "404": {
            "description": "Hike translation not found"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "hikes"
        ],
        "summary": "Replace Hike",
        "operationId": "replace_hike_api_hikes__hike_id__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HikeWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "delete": {
        "tags": [
          "hikes"
        ],
        "summary": "Delete Hike",
        "operationId": "delete_hike_api_hikes__hike_id__delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/hikes/{hike_id}/cover-image": {
      "get": {
        "tags": [
          "hikes"
        ],
        "summary": "Get Hike Cover Image",
        "operationId": "get_hike_cover_image_api_hikes__hike_id__cover_image_get",
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Image bytes",
            "content": {
              "image/png": {},
              "image/jpeg": {},
              "image/gif": {},
              "image/webp": {},
              "image/svg+xml": {}
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "hikes"
        ],
        "summary": "Upload Hike Cover Image",
        "operationId": "upload_hike_cover_image_api_hikes__hike_id__cover_image_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/octet-stream": {
              "schema": {
                "type": "string",
                "format": "binary"
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "hikes"
        ],
        "summary": "Delete Hike Cover Image",
        "operationId": "delete_hike_cover_image_api_hikes__hike_id__cover_image_delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/hikes/{locale}/{slug}": {
      "get": {
        "tags": [
          "hikes"
        ],
        "summary": "Get Hike By Slug",
        "operationId": "get_hike_by_slug_api_hikes__locale___slug__get",
        "parameters": [
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          },
          {
            "name": "slug",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Slug"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeRead"
                }
              }
            }
          },
          "308": {
            "description": "Old slug"
          },
          "404": {
            "description": "Hike translation not found"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/hikes/{hike_id}/translations/{locale}/review": {
      "put": {
        "tags": [
          "hikes"
        ],
        "summary": "Update Translation Review",
        "operationId": "update_translation_review_api_hikes__hike_id__translations__locale__review_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TranslationReviewWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeLocalizedRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/hikes/{hike_id}/translations/{locale}": {
      "put": {
        "tags": [
          "hikes"
        ],
        "summary": "Override Hike Translation",
        "operationId": "override_hike_translation_api_hikes__hike_id__translations__locale__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "hike_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Hike Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HikeEnglishContent"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HikeLocalizedRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/locations": {
      "get": {
        "tags": [
          "locations"
        ],
        "summary": "List Locations",
        "operationId": "list_locations_api_locations_get",
        "parameters": [
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 100,
              "minimum": 1,
              "description": "Maximum entries to return",
              "default": 10,
              "title": "Limit"
            },
            "description": "Maximum entries to return"
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "description": "Number of entries to skip",
              "default": 0,
              "title": "Offset"
            },
            "description": "Number of entries to skip"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Page_LocationRead_"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "locations"
        ],
        "summary": "Create Location",
        "operationId": "create_location_api_locations_post",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationWrite"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/locations/{location_id}": {
      "get": {
        "tags": [
          "locations"
        ],
        "summary": "Get Location",
        "operationId": "get_location_api_locations__location_id__get",
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          },
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "locations"
        ],
        "summary": "Update Location",
        "operationId": "update_location_api_locations__location_id__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "delete": {
        "tags": [
          "locations"
        ],
        "summary": "Delete Location",
        "operationId": "delete_location_api_locations__location_id__delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/locations/{location_id}/logo": {
      "put": {
        "tags": [
          "locations"
        ],
        "summary": "Upload Location Logo",
        "operationId": "upload_location_logo_api_locations__location_id__logo_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/octet-stream": {
              "schema": {
                "type": "string",
                "format": "binary"
              }
            }
          }
        }
      },
      "get": {
        "tags": [
          "locations"
        ],
        "summary": "Get Location Logo",
        "operationId": "get_location_logo_api_locations__location_id__logo_get",
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Image bytes",
            "content": {
              "image/png": {},
              "image/jpeg": {},
              "image/gif": {},
              "image/webp": {},
              "image/svg+xml": {}
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "locations"
        ],
        "summary": "Delete Location Logo",
        "operationId": "delete_location_logo_api_locations__location_id__logo_delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Location Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Root",
        "description": "Return a small API welcome payload.",
        "operationId": "root__get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Root  Get"
                }
              }
            }
          }
        }
      }
    },
    "/api/health": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Health",
        "description": "Report healthy only when the API can reach its database.",
        "operationId": "health_api_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Health Api Health Get"
                }
              }
            }
          },
          "503": {
            "description": "Database unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthUnavailable"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Health",
        "description": "Report healthy only when the API can reach its database.",
        "operationId": "health_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Health Health Get"
                }
              }
            }
          },
          "503": {
            "description": "Database unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthUnavailable"
                }
              }
            }
          }
        }
      }
    },
    "/api/regions": {
      "post": {
        "tags": [
          "region"
        ],
        "summary": "Create Region",
        "operationId": "create_region_api_regions_post",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegionWrite"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegionRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "get": {
        "tags": [
          "region"
        ],
        "summary": "List Region",
        "operationId": "list_region_api_regions_get",
        "parameters": [
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 100,
              "minimum": 1,
              "description": "Maximum entries to return",
              "default": 10,
              "title": "Limit"
            },
            "description": "Maximum entries to return"
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "description": "Number of entries to skip",
              "default": 0,
              "title": "Offset"
            },
            "description": "Number of entries to skip"
          },
          {
            "name": "hike_id",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uuid"
                },
                {
                  "type": "null"
                }
              ],
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Page_RegionRead_"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/regions/{entity_id}": {
      "get": {
        "tags": [
          "region"
        ],
        "summary": "Get Region",
        "operationId": "get_region_api_regions__entity_id__get",
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegionRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "region"
        ],
        "summary": "Update Region",
        "operationId": "update_region_api_regions__entity_id__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegionWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegionRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "delete": {
        "tags": [
          "region"
        ],
        "summary": "Delete Region",
        "operationId": "delete_region_api_regions__entity_id__delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/achievements": {
      "post": {
        "tags": [
          "achievement"
        ],
        "summary": "Create Achievement",
        "operationId": "create_achievement_api_achievements_post",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AchievementWrite"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AchievementRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "get": {
        "tags": [
          "achievement"
        ],
        "summary": "List Achievement",
        "operationId": "list_achievement_api_achievements_get",
        "parameters": [
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 100,
              "minimum": 1,
              "description": "Maximum entries to return",
              "default": 10,
              "title": "Limit"
            },
            "description": "Maximum entries to return"
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "description": "Number of entries to skip",
              "default": 0,
              "title": "Offset"
            },
            "description": "Number of entries to skip"
          },
          {
            "name": "hike_id",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uuid"
                },
                {
                  "type": "null"
                }
              ],
              "title": "Hike Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Page_AchievementRead_"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/achievements/{entity_id}": {
      "get": {
        "tags": [
          "achievement"
        ],
        "summary": "Get Achievement",
        "operationId": "get_achievement_api_achievements__entity_id__get",
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "en",
              "title": "Locale"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AchievementRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "achievement"
        ],
        "summary": "Update Achievement",
        "operationId": "update_achievement_api_achievements__entity_id__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AchievementWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AchievementRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      },
      "delete": {
        "tags": [
          "achievement"
        ],
        "summary": "Delete Achievement",
        "operationId": "delete_achievement_api_achievements__entity_id__delete",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Successful Response"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/locations/{entity_id}/translations/{locale}/review": {
      "put": {
        "tags": [
          "location translations"
        ],
        "summary": "Review",
        "operationId": "review_api_locations__entity_id__translations__locale__review_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReviewWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ReviewWrite"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/locations/{entity_id}/translations/{locale}": {
      "put": {
        "tags": [
          "location translations"
        ],
        "summary": "Override Location Translation",
        "operationId": "override_location_translation_api_locations__entity_id__translations__locale__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationEnglish"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/regions/{entity_id}/translations/{locale}/review": {
      "put": {
        "tags": [
          "region translations"
        ],
        "summary": "Review",
        "operationId": "review_api_regions__entity_id__translations__locale__review_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReviewWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ReviewWrite"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/regions/{entity_id}/translations/{locale}": {
      "put": {
        "tags": [
          "region translations"
        ],
        "summary": "Override Region Translation",
        "operationId": "override_region_translation_api_regions__entity_id__translations__locale__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegionEnglish"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegionRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/achievements/{entity_id}/translations/{locale}/review": {
      "put": {
        "tags": [
          "achievement translations"
        ],
        "summary": "Review",
        "operationId": "review_api_achievements__entity_id__translations__locale__review_put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReviewWrite"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ReviewWrite"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/achievements/{entity_id}/translations/{locale}": {
      "put": {
        "tags": [
          "achievement translations"
        ],
        "summary": "Override Achievement Translation",
        "operationId": "override_achievement_translation_api_achievements__entity_id__translations__locale__put",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "entity_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Locale"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AchievementEnglish"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AchievementRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        }
      }
    },
    "/api/translations/requeue": {
      "post": {
        "tags": [
          "translations"
        ],
        "summary": "Requeue Translations",
        "description": "Explicitly request flagged translations, or opt in to missing/outdated text.\n\nOptional entity and locale filters restrict the request. Manual overrides are\nalways protected. The worker processes the jobs; this endpoint never calls AI.",
        "operationId": "requeue_translations_api_translations_requeue_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/RequeueWrite"
                  },
                  {
                    "type": "null"
                  }
                ],
                "title": "Payload"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RequeueRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        },
        "security": [
          {
            "AdminBearer": []
          }
        ]
      }
    },
    "/api/translations/candidates": {
      "get": {
        "tags": [
          "translations"
        ],
        "summary": "List Translation Candidates",
        "description": "Preview the selected explicit-request scope without changing any state.",
        "operationId": "list_translation_candidates_api_translations_candidates_get",
        "security": [
          {
            "AdminBearer": []
          }
        ],
        "parameters": [
          {
            "name": "include_outdated",
            "in": "query",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false,
              "title": "Include Outdated"
            }
          },
          {
            "name": "entity_type",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "enum": [
                    "hike",
                    "location",
                    "region",
                    "achievement"
                  ],
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ],
              "title": "Entity Type"
            }
          },
          {
            "name": "entity_id",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "uuid"
                },
                {
                  "type": "null"
                }
              ],
              "title": "Entity Id"
            }
          },
          {
            "name": "locale",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "enum": [
                    "sv",
                    "cs"
                  ],
                  "type": "string"
                },
                {
                  "type": "null"
                }
              ],
              "title": "Locale"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "maximum": 100,
              "minimum": 1,
              "default": 10,
              "title": "Limit"
            }
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "default": 0,
              "title": "Offset"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Page_TranslationCandidateRead_"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          },
          "401": {
            "description": "Missing or invalid Bearer token"
          },
          "503": {
            "description": "API write access is not configured"
          }
        },
        "x-admin-only": true
      }
    }
  },
  "components": {
    "schemas": {
      "AccommodationType": {
        "type": "string",
        "enum": [
          "tent",
          "free_shelter_or_hut",
          "mountain_hut",
          "other_paid_accommodation"
        ],
        "title": "AccommodationType"
      },
      "AchievementEnglish": {
        "properties": {
          "title": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Title"
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description"
          }
        },
        "type": "object",
        "required": [
          "title"
        ],
        "title": "AchievementEnglish"
      },
      "AchievementIcon": {
        "type": "string",
        "enum": [
          "backpack",
          "trophy",
          "distance",
          "mountain",
          "compass",
          "tent",
          "arctic"
        ],
        "title": "AchievementIcon"
      },
      "AchievementRead": {
        "properties": {
          "title": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Title"
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description"
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "hike_id": {
            "type": "string",
            "format": "uuid",
            "title": "Hike Id"
          },
          "icon": {
            "$ref": "#/components/schemas/AchievementIcon"
          },
          "sort_order": {
            "type": "integer",
            "title": "Sort Order"
          },
          "translation": {
            "$ref": "#/components/schemas/TranslationMetadata"
          }
        },
        "type": "object",
        "required": [
          "title",
          "id",
          "hike_id",
          "icon",
          "sort_order",
          "translation"
        ],
        "title": "AchievementRead"
      },
      "AchievementWrite": {
        "properties": {
          "hike_id": {
            "type": "string",
            "format": "uuid",
            "title": "Hike Id"
          },
          "icon": {
            "$ref": "#/components/schemas/AchievementIcon"
          },
          "sort_order": {
            "type": "integer",
            "minimum": 0,
            "title": "Sort Order",
            "default": 0
          },
          "english": {
            "$ref": "#/components/schemas/AchievementEnglish"
          }
        },
        "type": "object",
        "required": [
          "hike_id",
          "icon",
          "english"
        ],
        "title": "AchievementWrite"
      },
      "ArcticCirclePosition": {
        "type": "string",
        "enum": [
          "south",
          "crosses",
          "north"
        ],
        "title": "ArcticCirclePosition"
      },
      "Direction": {
        "type": "string",
        "enum": [
          "northbound",
          "southbound",
          "eastbound",
          "westbound",
          "clockwise",
          "counterclockwise"
        ],
        "title": "Direction"
      },
      "EquipmentCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "equipment"
            ]
          },
          "url": {
            "type": "string",
            "maxLength": 2083,
            "minLength": 1,
            "format": "uri",
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "title": "EquipmentCard"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "HealthUnavailable": {
        "properties": {
          "detail": {
            "type": "string",
            "title": "Detail"
          }
        },
        "type": "object",
        "required": [
          "detail"
        ],
        "title": "HealthUnavailable",
        "description": "Error response when the database cannot be reached."
      },
      "HikeEnglishContent": {
        "properties": {
          "title": {
            "type": "string",
            "maxLength": 240,
            "minLength": 1,
            "title": "Title"
          },
          "tagline": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 500
              },
              {
                "type": "null"
              }
            ],
            "title": "Tagline"
          },
          "summary_markdown": {
            "type": "string",
            "minLength": 1,
            "title": "Summary Markdown"
          },
          "description_markdown": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description Markdown"
          }
        },
        "type": "object",
        "required": [
          "title",
          "summary_markdown"
        ],
        "title": "HikeEnglishContent"
      },
      "HikeLocalizedRead": {
        "properties": {
          "locale": {
            "type": "string",
            "title": "Locale"
          },
          "title": {
            "type": "string",
            "title": "Title"
          },
          "tagline": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Tagline"
          },
          "summary_markdown": {
            "type": "string",
            "title": "Summary Markdown"
          },
          "description_markdown": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description Markdown"
          },
          "slug": {
            "type": "string",
            "title": "Slug"
          },
          "review_status": {
            "$ref": "#/components/schemas/TranslationReviewStatus"
          },
          "is_outdated": {
            "type": "boolean",
            "title": "Is Outdated"
          }
        },
        "type": "object",
        "required": [
          "locale",
          "title",
          "tagline",
          "summary_markdown",
          "description_markdown",
          "slug",
          "review_status",
          "is_outdated"
        ],
        "title": "HikeLocalizedRead"
      },
      "HikeRead": {
        "properties": {
          "start_latitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 90,
                "minimum": -90
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Latitude"
          },
          "start_longitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 180,
                "minimum": -180
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Longitude"
          },
          "end_latitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 90,
                "minimum": -90
              },
              {
                "type": "null"
              }
            ],
            "title": "End Latitude"
          },
          "end_longitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 180,
                "minimum": -180
              },
              {
                "type": "null"
              }
            ],
            "title": "End Longitude"
          },
          "direction": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/Direction"
              },
              {
                "type": "null"
              }
            ]
          },
          "route_scope": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RouteScope"
              },
              {
                "type": "null"
              }
            ]
          },
          "start_stage": {
            "anyOf": [
              {
                "type": "integer",
                "exclusiveMinimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Stage"
          },
          "end_stage": {
            "anyOf": [
              {
                "type": "integer",
                "exclusiveMinimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "End Stage"
          },
          "overnights_recorded_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Overnights Recorded At"
          },
          "overnights": {
            "items": {
              "$ref": "#/components/schemas/OvernightWrite"
            },
            "type": "array",
            "title": "Overnights"
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "location": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/LocationRead"
              },
              {
                "type": "null"
              }
            ]
          },
          "status": {
            "$ref": "#/components/schemas/HikeStatus"
          },
          "planned_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned Start At"
          },
          "planned_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned End At"
          },
          "actual_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual Start At"
          },
          "actual_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual End At"
          },
          "distance_km": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Distance Km"
          },
          "ascent_m": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Ascent M"
          },
          "start_point": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Point"
          },
          "end_point": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "End Point"
          },
          "duration_days": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Duration Days"
          },
          "cover_image_url": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Cover Image Url"
          },
          "translation": {
            "$ref": "#/components/schemas/HikeLocalizedRead"
          },
          "cards": {
            "items": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/RouteCard"
                },
                {
                  "$ref": "#/components/schemas/ProgressCard"
                },
                {
                  "$ref": "#/components/schemas/LivePositionCard"
                },
                {
                  "$ref": "#/components/schemas/EquipmentCard"
                },
                {
                  "$ref": "#/components/schemas/SocialFeedCard"
                },
                {
                  "$ref": "#/components/schemas/YouTubeVideoCard"
                }
              ],
              "discriminator": {
                "propertyName": "type",
                "mapping": {
                  "equipment": "#/components/schemas/EquipmentCard",
                  "live_position": "#/components/schemas/LivePositionCard",
                  "progress": "#/components/schemas/ProgressCard",
                  "route": "#/components/schemas/RouteCard",
                  "social_feed": "#/components/schemas/SocialFeedCard",
                  "youtube_video": "#/components/schemas/YouTubeVideoCard"
                }
              }
            },
            "type": "array",
            "title": "Cards"
          },
          "achievements": {
            "items": {
              "$ref": "#/components/schemas/AchievementRead"
            },
            "type": "array",
            "title": "Achievements"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "title": "Created At"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "title": "Updated At"
          }
        },
        "type": "object",
        "required": [
          "id",
          "location",
          "status",
          "planned_start_at",
          "planned_end_at",
          "actual_start_at",
          "actual_end_at",
          "distance_km",
          "ascent_m",
          "start_point",
          "end_point",
          "duration_days",
          "cover_image_url",
          "translation",
          "cards",
          "achievements",
          "created_at",
          "updated_at"
        ],
        "title": "HikeRead"
      },
      "HikeStatus": {
        "type": "string",
        "enum": [
          "planned",
          "ongoing",
          "completed",
          "aborted"
        ],
        "title": "HikeStatus"
      },
      "HikeSummaryRead": {
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "location": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/LocationRead"
              },
              {
                "type": "null"
              }
            ]
          },
          "status": {
            "$ref": "#/components/schemas/HikeStatus"
          },
          "planned_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned Start At"
          },
          "planned_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned End At"
          },
          "actual_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual Start At"
          },
          "actual_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual End At"
          },
          "distance_km": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Distance Km"
          },
          "ascent_m": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Ascent M"
          },
          "start_point": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Point"
          },
          "end_point": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "End Point"
          },
          "duration_days": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Duration Days"
          },
          "cover_image_url": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Cover Image Url"
          },
          "translation": {
            "$ref": "#/components/schemas/HikeLocalizedRead"
          }
        },
        "type": "object",
        "required": [
          "id",
          "location",
          "status",
          "planned_start_at",
          "planned_end_at",
          "actual_start_at",
          "actual_end_at",
          "distance_km",
          "ascent_m",
          "start_point",
          "end_point",
          "duration_days",
          "cover_image_url",
          "translation"
        ],
        "title": "HikeSummaryRead"
      },
      "HikeWrite": {
        "properties": {
          "start_latitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 90,
                "minimum": -90
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Latitude"
          },
          "start_longitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 180,
                "minimum": -180
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Longitude"
          },
          "end_latitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 90,
                "minimum": -90
              },
              {
                "type": "null"
              }
            ],
            "title": "End Latitude"
          },
          "end_longitude": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 180,
                "minimum": -180
              },
              {
                "type": "null"
              }
            ],
            "title": "End Longitude"
          },
          "direction": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/Direction"
              },
              {
                "type": "null"
              }
            ]
          },
          "route_scope": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RouteScope"
              },
              {
                "type": "null"
              }
            ]
          },
          "start_stage": {
            "anyOf": [
              {
                "type": "integer",
                "exclusiveMinimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Stage"
          },
          "end_stage": {
            "anyOf": [
              {
                "type": "integer",
                "exclusiveMinimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "End Stage"
          },
          "overnights_recorded_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Overnights Recorded At"
          },
          "overnights": {
            "items": {
              "$ref": "#/components/schemas/OvernightWrite"
            },
            "type": "array",
            "title": "Overnights"
          },
          "location_id": {
            "anyOf": [
              {
                "type": "string",
                "format": "uuid"
              },
              {
                "type": "null"
              }
            ],
            "title": "Location Id"
          },
          "status": {
            "$ref": "#/components/schemas/HikeStatus",
            "default": "planned"
          },
          "planned_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned Start At"
          },
          "planned_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Planned End At"
          },
          "actual_start_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual Start At"
          },
          "actual_end_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "null"
              }
            ],
            "title": "Actual End At"
          },
          "distance_km": {
            "anyOf": [
              {
                "type": "number",
                "maximum": 999_999.99,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Distance Km"
          },
          "ascent_m": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Ascent M"
          },
          "start_point": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 300
              },
              {
                "type": "null"
              }
            ],
            "title": "Start Point"
          },
          "end_point": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 300
              },
              {
                "type": "null"
              }
            ],
            "title": "End Point"
          },
          "english": {
            "$ref": "#/components/schemas/HikeEnglishContent"
          },
          "cards": {
            "items": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/RouteCard"
                },
                {
                  "$ref": "#/components/schemas/ProgressCard"
                },
                {
                  "$ref": "#/components/schemas/LivePositionCard"
                },
                {
                  "$ref": "#/components/schemas/EquipmentCard"
                },
                {
                  "$ref": "#/components/schemas/SocialFeedCard"
                },
                {
                  "$ref": "#/components/schemas/YouTubeVideoCard"
                }
              ],
              "discriminator": {
                "propertyName": "type",
                "mapping": {
                  "equipment": "#/components/schemas/EquipmentCard",
                  "live_position": "#/components/schemas/LivePositionCard",
                  "progress": "#/components/schemas/ProgressCard",
                  "route": "#/components/schemas/RouteCard",
                  "social_feed": "#/components/schemas/SocialFeedCard",
                  "youtube_video": "#/components/schemas/YouTubeVideoCard"
                }
              }
            },
            "type": "array",
            "title": "Cards"
          }
        },
        "type": "object",
        "required": [
          "english"
        ],
        "title": "HikeWrite"
      },
      "InformationStatus": {
        "type": "string",
        "enum": [
          "unknown",
          "known"
        ],
        "title": "InformationStatus"
      },
      "LivePositionCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "live_position"
            ]
          },
          "state": {
            "type": "string",
            "enum": [
              "active",
              "inactive"
            ],
            "title": "State"
          },
          "url": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 2083,
                "minLength": 1,
                "format": "uri"
              },
              {
                "type": "null"
              }
            ],
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "state"
        ],
        "title": "LivePositionCard"
      },
      "LocationEnglish": {
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Name"
          },
          "season_note": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Season Note"
          },
          "overnight_restrictions_note": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Overnight Restrictions Note"
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "LocationEnglish"
      },
      "LocationKind": {
        "type": "string",
        "enum": [
          "trail",
          "area"
        ],
        "title": "LocationKind"
      },
      "LocationRead": {
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Name"
          },
          "season_note": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Season Note"
          },
          "overnight_restrictions_note": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Overnight Restrictions Note"
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "kind": {
            "$ref": "#/components/schemas/LocationKind"
          },
          "official_url": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Official Url"
          },
          "logo_url": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Logo Url"
          },
          "waymarking": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/Waymarking"
              },
              {
                "type": "null"
              }
            ]
          },
          "is_loop": {
            "anyOf": [
              {
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ],
            "title": "Is Loop"
          },
          "arctic_circle_position": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/ArcticCirclePosition"
              },
              {
                "type": "null"
              }
            ]
          },
          "information_checked_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date"
              },
              {
                "type": "null"
              }
            ],
            "title": "Information Checked At"
          },
          "country_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Country Codes"
          },
          "terrains": {
            "items": {
              "$ref": "#/components/schemas/TrailType"
            },
            "type": "array",
            "title": "Terrains"
          },
          "regions": {
            "items": {
              "$ref": "#/components/schemas/RegionRead"
            },
            "type": "array",
            "title": "Regions"
          },
          "hiking_months": {
            "anyOf": [
              {
                "items": {
                  "type": "integer"
                },
                "type": "array"
              },
              {
                "type": "null"
              }
            ],
            "title": "Hiking Months"
          },
          "water_sources_status": {
            "$ref": "#/components/schemas/InformationStatus"
          },
          "water_sources": {
            "items": {
              "$ref": "#/components/schemas/WaterSourceType"
            },
            "type": "array",
            "title": "Water Sources"
          },
          "overnight_options_status": {
            "$ref": "#/components/schemas/InformationStatus"
          },
          "overnight_options": {
            "items": {
              "$ref": "#/components/schemas/AccommodationType"
            },
            "type": "array",
            "title": "Overnight Options"
          },
          "overnight_restrictions_status": {
            "$ref": "#/components/schemas/InformationStatus"
          },
          "overnight_restrictions": {
            "items": {
              "$ref": "#/components/schemas/RestrictionType"
            },
            "type": "array",
            "title": "Overnight Restrictions"
          },
          "ratings": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RatingWrite"
              },
              {
                "type": "null"
              }
            ]
          },
          "translation": {
            "$ref": "#/components/schemas/TranslationMetadata"
          }
        },
        "type": "object",
        "required": [
          "name",
          "id",
          "kind",
          "official_url",
          "logo_url",
          "waymarking",
          "is_loop",
          "arctic_circle_position",
          "information_checked_at",
          "country_codes",
          "terrains",
          "regions",
          "hiking_months",
          "water_sources_status",
          "water_sources",
          "overnight_options_status",
          "overnight_options",
          "overnight_restrictions_status",
          "overnight_restrictions",
          "ratings",
          "translation"
        ],
        "title": "LocationRead"
      },
      "LocationWrite": {
        "properties": {
          "kind": {
            "$ref": "#/components/schemas/LocationKind",
            "default": "trail"
          },
          "english": {
            "$ref": "#/components/schemas/LocationEnglish"
          },
          "official_url": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 2083,
                "minLength": 1,
                "format": "uri"
              },
              {
                "type": "null"
              }
            ],
            "title": "Official Url"
          },
          "waymarking": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/Waymarking"
              },
              {
                "type": "null"
              }
            ]
          },
          "is_loop": {
            "anyOf": [
              {
                "type": "boolean"
              },
              {
                "type": "null"
              }
            ],
            "title": "Is Loop"
          },
          "arctic_circle_position": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/ArcticCirclePosition"
              },
              {
                "type": "null"
              }
            ]
          },
          "information_checked_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date"
              },
              {
                "type": "null"
              }
            ],
            "title": "Information Checked At"
          },
          "country_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "minItems": 1,
            "title": "Country Codes"
          },
          "terrains": {
            "items": {
              "$ref": "#/components/schemas/TrailType"
            },
            "type": "array",
            "title": "Terrains"
          },
          "region_ids": {
            "items": {
              "type": "string",
              "format": "uuid"
            },
            "type": "array",
            "title": "Region Ids"
          },
          "hiking_months": {
            "anyOf": [
              {
                "items": {
                  "type": "integer"
                },
                "type": "array"
              },
              {
                "type": "null"
              }
            ],
            "title": "Hiking Months"
          },
          "water_sources_status": {
            "$ref": "#/components/schemas/InformationStatus",
            "default": "unknown"
          },
          "water_sources": {
            "items": {
              "$ref": "#/components/schemas/WaterSourceType"
            },
            "type": "array",
            "title": "Water Sources"
          },
          "overnight_options_status": {
            "$ref": "#/components/schemas/InformationStatus",
            "default": "unknown"
          },
          "overnight_options": {
            "items": {
              "$ref": "#/components/schemas/AccommodationType"
            },
            "type": "array",
            "title": "Overnight Options"
          },
          "overnight_restrictions_status": {
            "$ref": "#/components/schemas/InformationStatus",
            "default": "unknown"
          },
          "overnight_restrictions": {
            "items": {
              "$ref": "#/components/schemas/RestrictionType"
            },
            "type": "array",
            "title": "Overnight Restrictions"
          },
          "ratings": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RatingWrite"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "type": "object",
        "required": [
          "english",
          "country_codes"
        ],
        "title": "LocationWrite"
      },
      "OvernightWrite": {
        "properties": {
          "accommodation_type": {
            "$ref": "#/components/schemas/AccommodationType"
          },
          "night_count": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "title": "Night Count"
          }
        },
        "type": "object",
        "required": [
          "accommodation_type",
          "night_count"
        ],
        "title": "OvernightWrite"
      },
      "Page_AchievementRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/AchievementRead"
            },
            "type": "array",
            "title": "Items"
          },
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "limit": {
            "type": "integer",
            "title": "Limit"
          },
          "offset": {
            "type": "integer",
            "title": "Offset"
          }
        },
        "type": "object",
        "required": [
          "items",
          "total",
          "limit",
          "offset"
        ],
        "title": "Page[AchievementRead]"
      },
      "Page_HikeSummaryRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/HikeSummaryRead"
            },
            "type": "array",
            "title": "Items"
          },
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "limit": {
            "type": "integer",
            "title": "Limit"
          },
          "offset": {
            "type": "integer",
            "title": "Offset"
          }
        },
        "type": "object",
        "required": [
          "items",
          "total",
          "limit",
          "offset"
        ],
        "title": "Page[HikeSummaryRead]"
      },
      "Page_LocationRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/LocationRead"
            },
            "type": "array",
            "title": "Items"
          },
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "limit": {
            "type": "integer",
            "title": "Limit"
          },
          "offset": {
            "type": "integer",
            "title": "Offset"
          }
        },
        "type": "object",
        "required": [
          "items",
          "total",
          "limit",
          "offset"
        ],
        "title": "Page[LocationRead]"
      },
      "Page_RegionRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/RegionRead"
            },
            "type": "array",
            "title": "Items"
          },
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "limit": {
            "type": "integer",
            "title": "Limit"
          },
          "offset": {
            "type": "integer",
            "title": "Offset"
          }
        },
        "type": "object",
        "required": [
          "items",
          "total",
          "limit",
          "offset"
        ],
        "title": "Page[RegionRead]"
      },
      "Page_TranslationCandidateRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/TranslationCandidateRead"
            },
            "type": "array",
            "title": "Items"
          },
          "total": {
            "type": "integer",
            "title": "Total"
          },
          "limit": {
            "type": "integer",
            "title": "Limit"
          },
          "offset": {
            "type": "integer",
            "title": "Offset"
          }
        },
        "type": "object",
        "required": [
          "items",
          "total",
          "limit",
          "offset"
        ],
        "title": "Page[TranslationCandidateRead]"
      },
      "ProgressCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "progress"
            ]
          },
          "url": {
            "type": "string",
            "maxLength": 2083,
            "minLength": 1,
            "format": "uri",
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "title": "ProgressCard"
      },
      "RatingWrite": {
        "properties": {
          "facilities": {
            "anyOf": [
              {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Facilities"
          },
          "maintenance": {
            "anyOf": [
              {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Maintenance"
          },
          "resupplies": {
            "anyOf": [
              {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Resupplies"
          },
          "public_transport": {
            "anyOf": [
              {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Public Transport"
          },
          "difficulty": {
            "anyOf": [
              {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              {
                "type": "null"
              }
            ],
            "title": "Difficulty"
          },
          "assessed_at": {
            "anyOf": [
              {
                "type": "string",
                "format": "date"
              },
              {
                "type": "null"
              }
            ],
            "title": "Assessed At"
          }
        },
        "type": "object",
        "title": "RatingWrite"
      },
      "RegionEnglish": {
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Name"
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "RegionEnglish"
      },
      "RegionRead": {
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Name"
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "translation": {
            "$ref": "#/components/schemas/TranslationMetadata"
          }
        },
        "type": "object",
        "required": [
          "name",
          "id",
          "translation"
        ],
        "title": "RegionRead"
      },
      "RegionWrite": {
        "properties": {
          "english": {
            "$ref": "#/components/schemas/RegionEnglish"
          }
        },
        "type": "object",
        "required": [
          "english"
        ],
        "title": "RegionWrite"
      },
      "RequeueRead": {
        "properties": {
          "queued": {
            "type": "integer",
            "title": "Queued"
          },
          "skipped": {
            "type": "integer",
            "title": "Skipped"
          }
        },
        "type": "object",
        "required": [
          "queued",
          "skipped"
        ],
        "title": "RequeueRead"
      },
      "RequeueWrite": {
        "properties": {
          "include_outdated": {
            "type": "boolean",
            "title": "Include Outdated",
            "default": false
          },
          "entity_type": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "hike",
                  "location",
                  "region",
                  "achievement"
                ]
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity Type"
          },
          "entity_id": {
            "anyOf": [
              {
                "type": "string",
                "format": "uuid"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity Id"
          },
          "locale": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "sv",
                  "cs"
                ]
              },
              {
                "type": "null"
              }
            ],
            "title": "Locale"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "title": "RequeueWrite"
      },
      "RestrictionType": {
        "type": "string",
        "enum": [
          "camping_restricted",
          "advance_booking_required",
          "fees_apply"
        ],
        "title": "RestrictionType"
      },
      "ReviewWrite": {
        "properties": {
          "review_status": {
            "$ref": "#/components/schemas/TranslationReviewStatus"
          }
        },
        "type": "object",
        "required": [
          "review_status"
        ],
        "title": "ReviewWrite"
      },
      "RouteCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "route"
            ]
          },
          "url": {
            "type": "string",
            "maxLength": 2083,
            "minLength": 1,
            "format": "uri",
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "title": "RouteCard"
      },
      "RouteScope": {
        "type": "string",
        "enum": [
          "full_trail",
          "trail_section",
          "custom_route"
        ],
        "title": "RouteScope"
      },
      "SocialFeedCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "social_feed"
            ]
          },
          "url": {
            "type": "string",
            "maxLength": 2083,
            "minLength": 1,
            "format": "uri",
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "title": "SocialFeedCard"
      },
      "TrailType": {
        "type": "string",
        "enum": [
          "mountains",
          "lowlands",
          "coastal"
        ],
        "title": "TrailType"
      },
      "TranslationCandidateRead": {
        "properties": {
          "entity_type": {
            "type": "string",
            "enum": [
              "hike",
              "location",
              "region",
              "achievement"
            ],
            "title": "Entity Type"
          },
          "entity_id": {
            "type": "string",
            "format": "uuid",
            "title": "Entity Id"
          },
          "title": {
            "type": "string",
            "title": "Title"
          },
          "locale": {
            "type": "string",
            "enum": [
              "sv",
              "cs"
            ],
            "title": "Locale"
          },
          "review_status": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Review Status"
          },
          "is_missing": {
            "type": "boolean",
            "title": "Is Missing"
          },
          "is_outdated": {
            "type": "boolean",
            "title": "Is Outdated"
          },
          "already_queued": {
            "type": "boolean",
            "title": "Already Queued"
          }
        },
        "type": "object",
        "required": [
          "entity_type",
          "entity_id",
          "title",
          "locale",
          "review_status",
          "is_missing",
          "is_outdated",
          "already_queued"
        ],
        "title": "TranslationCandidateRead"
      },
      "TranslationMetadata": {
        "properties": {
          "locale": {
            "type": "string",
            "title": "Locale"
          },
          "review_status": {
            "$ref": "#/components/schemas/TranslationReviewStatus"
          },
          "is_outdated": {
            "type": "boolean",
            "title": "Is Outdated"
          }
        },
        "type": "object",
        "required": [
          "locale",
          "review_status",
          "is_outdated"
        ],
        "title": "TranslationMetadata"
      },
      "TranslationReviewStatus": {
        "type": "string",
        "enum": [
          "manual",
          "source",
          "unreviewed",
          "approved",
          "needs_retranslation"
        ],
        "title": "TranslationReviewStatus"
      },
      "TranslationReviewWrite": {
        "properties": {
          "review_status": {
            "type": "string",
            "enum": [
              "unreviewed",
              "approved",
              "needs_retranslation",
              "manual"
            ],
            "title": "Review Status"
          }
        },
        "type": "object",
        "required": [
          "review_status"
        ],
        "title": "TranslationReviewWrite"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          },
          "input": {
            "title": "Input"
          },
          "ctx": {
            "type": "object",
            "title": "Context"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      },
      "WaterSourceType": {
        "type": "string",
        "enum": [
          "tap",
          "shop",
          "natural"
        ],
        "title": "WaterSourceType"
      },
      "Waymarking": {
        "type": "string",
        "enum": [
          "waymarked",
          "partly_waymarked",
          "unmarked"
        ],
        "title": "Waymarking"
      },
      "YouTubeVideoCard": {
        "properties": {
          "type": {
            "type": "string",
            "title": "Type",
            "enum": [
              "youtube_video"
            ]
          },
          "url": {
            "type": "string",
            "maxLength": 2083,
            "minLength": 1,
            "format": "uri",
            "title": "Url"
          }
        },
        "additionalProperties": false,
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "title": "YouTubeVideoCard"
      }
    },
    "securitySchemes": {
      "AdminBearer": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
} as const
