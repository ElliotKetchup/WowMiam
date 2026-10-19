package expo.modules.wowmiamcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Executors
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Turns a dish photo into a die-cut sticker, on the phone: ML Kit finds the subject (the plate and
 * what's on it), everything else becomes transparent, then a white rim and a soft shadow are drawn
 * around it, like the bundled stickers. Resolves null when no clear subject was found.
 */
class CutoutModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("WowMiamCutout")

    AsyncFunction("cutOutAsync") { sourceUri: String, destUri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_CONTEXT", "Android context unavailable", null)
      } else {
        worker.execute { segment(context, sourceUri, destUri, promise) }
      }
    }
  }

  private fun segment(context: Context, sourceUri: String, destUri: String, promise: Promise) {
    val source = try {
      loadBitmap(context, Uri.parse(sourceUri))
    } catch (e: Exception) {
      promise.reject("E_READ", e.message ?: "Unreadable image", e)
      return
    }
    val segmenter = SubjectSegmentation.getClient(SubjectSegmenterOptions.Builder().enableForegroundBitmap().build())
    segmenter.process(InputImage.fromBitmap(source, 0))
      .addOnSuccessListener(worker) { result ->
        try {
          val sticker = result.foregroundBitmap?.let { makeSticker(it) }
          if (sticker == null) {
            promise.resolve(null)
          } else {
            write(sticker, destUri)
            promise.resolve(mapOf("uri" to destUri, "width" to sticker.width, "height" to sticker.height))
          }
        } catch (e: Exception) {
          promise.reject("E_STICKER", e.message ?: "Sticker failed", e)
        } finally {
          segmenter.close()
        }
      }
      .addOnFailureListener(worker) { e ->
        segmenter.close()
        // While Play services is still downloading the model, ML Kit fails with UNAVAILABLE.
        promise.reject("E_SEGMENT", e.message ?: "Segmentation failed", e)
      }
  }

  /** Decodes at most MAX_INPUT px on the long side, upright. */
  private fun loadBitmap(context: Context, uri: Uri): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(context, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_INPUT) sample *= 2
    val decoded = open(context, uri).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
      ?: throw IOException("Unreadable image")
    val orientation = try {
      open(context, uri).use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
    }
    val scale = min(1f, MAX_INPUT.toFloat() / max(decoded.width, decoded.height))
    matrix.postScale(scale, scale)
    return Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
  }

  private fun open(context: Context, uri: Uri): InputStream =
    if (uri.scheme == null || uri.scheme == "file") FileInputStream(uri.path ?: throw IOException("No path"))
    else context.contentResolver.openInputStream(uri) ?: throw IOException("Cannot open $uri")

  /** Crops to the subject, then lays shadow, white rim and subject on a transparent canvas. */
  private fun makeSticker(foreground: Bitmap): Bitmap? {
    val w = foreground.width
    val h = foreground.height
    val pixels = IntArray(w * h)
    foreground.getPixels(pixels, 0, w, 0, 0, w, h)
    var minX = w
    var minY = h
    var maxX = -1
    var maxY = -1
    var solid = 0
    for (y in 0 until h) {
      for (x in 0 until w) {
        if ((pixels[y * w + x] ushr 24) > 96) {
          solid++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    // Too little was kept to be a dish: better a round photo than a crumb.
    if (maxX < 0 || solid < w * h * MIN_COVERAGE) return null

    val subject = Bitmap.createBitmap(foreground, minX, minY, maxX - minX + 1, maxY - minY + 1)
    val rimWidth = max(6f, max(subject.width, subject.height) * RIM)
    val pad = (rimWidth * 3).roundToInt()
    val outW = subject.width + pad * 2
    val outH = subject.height + pad * 2
    val silhouette = subject.extractAlpha()

    // The rim: the silhouette stamped all around two circles, so thin parts get a solid edge too.
    val rim = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
    val rimCanvas = Canvas(rim)
    val white = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    for (radius in floatArrayOf(rimWidth, rimWidth / 2)) {
      for (i in 0 until STAMPS) {
        val angle = 2 * Math.PI * i / STAMPS
        rimCanvas.drawBitmap(silhouette, pad + (cos(angle) * radius).toFloat(), pad + (sin(angle) * radius).toFloat(), white)
      }
    }
    rimCanvas.drawBitmap(silhouette, pad.toFloat(), pad.toFloat(), white)

    val out = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(70, 42, 21, 48)
      maskFilter = BlurMaskFilter(rimWidth * 1.1f, BlurMaskFilter.Blur.NORMAL)
    }
    canvas.drawBitmap(rim.extractAlpha(), 0f, rimWidth * 0.6f, shadow)
    canvas.drawBitmap(rim, 0f, 0f, null)
    canvas.drawBitmap(subject, pad.toFloat(), pad.toFloat(), null)

    val scale = min(1f, MAX_OUTPUT.toFloat() / max(outW, outH))
    return if (scale < 1f) Bitmap.createScaledBitmap(out, (outW * scale).roundToInt(), (outH * scale).roundToInt(), true) else out
  }

  private fun write(bitmap: Bitmap, destUri: String) {
    val file = File(Uri.parse(destUri).path ?: throw IOException("Bad destination"))
    file.parentFile?.mkdirs()
    FileOutputStream(file).use { bitmap.compress(webp(), 86, it) }
  }

  /** Lossy WebP keeps the transparency at a fraction of a PNG's size. */
  @Suppress("DEPRECATION")
  private fun webp(): Bitmap.CompressFormat =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP

  companion object {
    private const val MAX_INPUT = 1280
    private const val MAX_OUTPUT = 900
    private const val MIN_COVERAGE = 0.03
    private const val RIM = 0.032f
    private const val STAMPS = 32
  }
}
