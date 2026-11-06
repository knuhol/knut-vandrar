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
          }
        }
      },
      "delete": {
        "tags": [
          "hikes"
        ],
        "summary": "Delete Hike",
        "operationId": "delete_hike_api_hikes__hike_id__delete",
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
          }
        }
      }
    },
    "/api/trails": {
      "get": {
        "tags": [
          "trails"
        ],
        "summary": "List Trails",
        "operationId": "list_trails_api_trails_get",
        "parameters": [
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
                  "$ref": "#/components/schemas/Page_TrailRead_"
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
          "trails"
        ],
        "summary": "Create Trail",
        "operationId": "create_trail_api_trails_post",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TrailWrite"
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
                  "$ref": "#/components/schemas/TrailRead"
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
    "/api/trails/{trail_id}": {
      "get": {
        "tags": [
          "trails"
        ],
        "summary": "Get Trail",
        "operationId": "get_trail_api_trails__trail_id__get",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TrailRead"
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
          "trails"
        ],
        "summary": "Update Trail",
        "operationId": "update_trail_api_trails__trail_id__put",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TrailWrite"
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
                  "$ref": "#/components/schemas/TrailRead"
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
      "delete": {
        "tags": [
          "trails"
        ],
        "summary": "Delete Trail",
        "operationId": "delete_trail_api_trails__trail_id__delete",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
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
          }
        }
      }
    },
    "/api/trails/{trail_id}/logo": {
      "put": {
        "tags": [
          "trails"
        ],
        "summary": "Upload Trail Logo",
        "description": "Store a PNG, JPEG, WebP, GIF, or SVG logo and return its backend URL.",
        "operationId": "upload_trail_logo_api_trails__trail_id__logo_put",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TrailRead"
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
          "trails"
        ],
        "summary": "Get Trail Logo",
        "operationId": "get_trail_logo_api_trails__trail_id__logo_get",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
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
          "trails"
        ],
        "summary": "Delete Trail Logo",
        "operationId": "delete_trail_logo_api_trails__trail_id__logo_delete",
        "parameters": [
          {
            "name": "trail_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "title": "Trail Id"
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
    }
  },
  "components": {
    "schemas": {
      "EquipmentCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "equipment",
            "title": "Type"
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
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "trail": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TrailRead"
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
                "type": "integer"
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
          "trail",
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
          "trail": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TrailRead"
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
                "type": "integer"
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
          "trail",
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
          "trail_id": {
            "anyOf": [
              {
                "type": "string",
                "format": "uuid"
              },
              {
                "type": "null"
              }
            ],
            "title": "Trail Id"
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
                "type": "integer",
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
      "LivePositionCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "live_position",
            "title": "Type"
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
      "Page_TrailRead_": {
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/TrailRead"
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
        "title": "Page[TrailRead]"
      },
      "ProgressCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "progress",
            "title": "Type"
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
      "RouteCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "route",
            "title": "Type"
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
      "SocialFeedCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "social_feed",
            "title": "Type"
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
      "TrailRead": {
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "title": "Id"
          },
          "name": {
            "type": "string",
            "title": "Name"
          },
          "type": {
            "$ref": "#/components/schemas/TrailType"
          },
          "country_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Country Codes"
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
            "title": "Logo Url",
            "description": "Backend URL for this trail's logo, when one has been uploaded."
          }
        },
        "type": "object",
        "required": [
          "id",
          "name",
          "type",
          "country_codes",
          "official_url",
          "logo_url"
        ],
        "title": "TrailRead"
      },
      "TrailType": {
        "type": "string",
        "enum": [
          "mountains",
          "lowlands"
        ],
        "title": "TrailType"
      },
      "TrailWrite": {
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 200,
            "minLength": 1,
            "title": "Name"
          },
          "type": {
            "$ref": "#/components/schemas/TrailType"
          },
          "country_codes": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "minItems": 1,
            "title": "Country Codes"
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
          }
        },
        "type": "object",
        "required": [
          "name",
          "type",
          "country_codes"
        ],
        "title": "TrailWrite"
      },
      "TranslationReviewStatus": {
        "type": "string",
        "enum": [
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
              "needs_retranslation"
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
      "YouTubeVideoCard": {
        "properties": {
          "type": {
            "type": "string",
            "const": "youtube_video",
            "title": "Type"
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
    }
  }
} as const
